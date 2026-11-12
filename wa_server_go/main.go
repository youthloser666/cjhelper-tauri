package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
	_ "modernc.org/sqlite"
)

// -----------------------------------------------------------------------------
// State Machine & Types
// -----------------------------------------------------------------------------

type ConnectionState string

const (
	StateDisconnected ConnectionState = "DISCONNECTED"
	StateQRReady      ConnectionState = "QR_READY"
	StateConnected    ConnectionState = "CONNECTED"
)

type WAServer struct {
	mu sync.RWMutex

	port      int
	dbPath    string
	container *sqlstore.Container
	device    *store.Device
	client    *whatsmeow.Client

	state    ConnectionState
	latestQR string
	logs     []string

	groupsCache     []GroupItem
	groupsCacheTime time.Time
	isLoggingOut    bool
	retryCache      *SentMessageCache
}

type GroupItem struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type SendRequest struct {
	GroupID string `json:"group_id"`
	Message string `json:"message"`
}

type BroadcastTargetItem struct {
	GroupID string `json:"group_id"`
	JID     string `json:"jid"`
	Message string `json:"message"`
}

type BroadcastRequest struct {
	Targets []BroadcastTargetItem `json:"targets"`
	DelayMS int                   `json:"delay_ms"`
}

type TargetResultItem struct {
	GroupID string `json:"group_id"`
	JID     string `json:"jid"`
	OK      bool   `json:"ok"`
	Error   string `json:"error,omitempty"`
}

type BroadcastResponse struct {
	OK      bool               `json:"ok"`
	Total   int                `json:"total"`
	Success int                `json:"success"`
	Failed  int                `json:"failed"`
	Results []TargetResultItem `json:"results"`
}

// -----------------------------------------------------------------------------
// Initialization & Lifecycle
// -----------------------------------------------------------------------------

func NewWAServer(port int, dbPath string) *WAServer {
	return &WAServer{
		port:       port,
		dbPath:     dbPath,
		state:      StateDisconnected,
		logs:       make([]string, 0, 100),
		retryCache: NewSentMessageCache(2000, 24*time.Hour),
	}
}

func (s *WAServer) addLog(msg string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.addLogLocked(msg)
}

func (s *WAServer) addLogLocked(msg string) {
	entry := fmt.Sprintf("[%s] %s", time.Now().Format("15:04:05"), msg)
	log.Println(entry)
	s.logs = append(s.logs, entry)
	if len(s.logs) > 100 {
		s.logs = s.logs[len(s.logs)-100:]
	}
}

func (s *WAServer) initClient(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.addLogLocked("Menginisialisasi WhatsApp Client (Whatsmeow Go)...")

	// Ensure directory exists
	dir := filepath.Dir(s.dbPath)
	if dir != "" && dir != "." {
		_ = os.MkdirAll(dir, 0755)
	}

	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)", filepath.ToSlash(s.dbPath))
	logger := waLog.Noop

	container, err := sqlstore.New(ctx, "sqlite", dsn, logger)
	if err != nil {
		s.addLogLocked(fmt.Sprintf("Gagal membuka database sesi SQLite: %v", err))
		return err
	}

	device, err := container.GetFirstDevice(ctx)
	if err != nil {
		_ = container.Close()
		s.addLogLocked(fmt.Sprintf("Gagal memuat device dari database: %v", err))
		return err
	}

	client := whatsmeow.NewClient(device, logger)
	client.UseRetryMessageStore = true
	client.AutoTrustIdentity = true
	client.EnableAutoReconnect = true
	client.InitialAutoReconnect = true
	client.AutomaticMessageRerequestFromPhone = true
	client.GetMessageForRetry = func(requester, to types.JID, id types.MessageID) *waE2E.Message {
		if s.retryCache == nil {
			return nil
		}
		recovered := s.retryCache.Lookup(requester, to, id, func(jid types.JID) []types.JID {
			ctxLookup, cancelLookup := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancelLookup()
			return resolveAliasJIDs(ctxLookup, client, jid)
		})
		if recovered != nil {
			s.addLog(fmt.Sprintf("Melayani retry enkripsi E2EE pesan %s untuk device %s", id, requester.String()))
		}
		return recovered
	}
	client.AddEventHandler(s.handleEvent)

	s.container = container
	s.device = device
	s.client = client
	s.state = StateDisconnected

	s.addLogLocked(fmt.Sprintf("Whatsmeow siap. Database sesi: %s", s.dbPath))
	return nil
}

func (s *WAServer) startConnection(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.client == nil {
		return errors.New("client belum diinisialisasi")
	}

	if s.client.IsConnected() {
		return nil
	}

	if s.client.Store.ID == nil {
		// Belum login -> Minta QR channel
		s.addLogLocked("Membuat QR Code baru...")
		qrChan, err := s.client.GetQRChannel(ctx)
		if err != nil {
			s.addLogLocked(fmt.Sprintf("Gagal mengambil QR channel: %v", err))
			return err
		}

		err = s.client.Connect()
		if err != nil {
			s.addLogLocked(fmt.Sprintf("Gagal menghubungkan ke WhatsApp: %v", err))
			return err
		}

		go s.listenQR(qrChan)
	} else {
		// Sudah ada sesi login tersimpan — tunggu event *events.Connected agar prekeys & sesi siap penuh.
		s.addLogLocked("Menghubungkan ke server WhatsApp dengan sesi tersimpan...")
		err := s.client.Connect()
		if err != nil {
			s.addLogLocked(fmt.Sprintf("Gagal menghubungkan sesi: %v", err))
			return err
		}
		if s.client.IsConnected() && s.client.IsLoggedIn() && (s.client.PreKeysUploaded == nil || s.client.PreKeysUploaded.IsSet()) {
			s.state = StateConnected
		}
	}

	return nil
}

func (s *WAServer) markReadyWhenPreKeysSynced(cli *whatsmeow.Client) {
	if cli != nil && cli.PreKeysUploaded != nil {
		cli.PreKeysUploaded.WaitTimeout(3 * time.Second)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.client != cli || s.isLoggingOut {
		return
	}
	if cli != nil && cli.IsConnected() && cli.IsLoggedIn() {
		s.state = StateConnected
		s.latestQR = ""
		s.addLogLocked("Koneksi WhatsApp & prekey Signal aktif (CONNECTED).")
	}
}

func (s *WAServer) listenQR(qrChan <-chan whatsmeow.QRChannelItem) {
	for evt := range qrChan {
		s.mu.Lock()
		switch evt.Event {
		case "code":
			s.latestQR = evt.Code
			s.state = StateQRReady
			s.addLogLocked("QR Code baru telah dibuat. Silakan scan melalui HP Anda.")
		case "success":
			s.latestQR = ""
			s.state = StateConnected
			s.addLogLocked("WhatsApp Terhubung! Sesi berhasil disinkronkan.")
			go func() {
				time.Sleep(2 * time.Second)
				_ = s.refreshGroups(context.Background())
			}()
		case "timeout":
			s.latestQR = ""
			s.state = StateDisconnected
			s.addLogLocked("QR Code kadaluarsa (timeout). Mempersiapkan ulang...")
		}
		s.mu.Unlock()
	}
}

func (s *WAServer) handleEvent(evt interface{}) {
	switch e := evt.(type) {
	case *events.Connected:
		s.mu.RLock()
		cli := s.client
		s.mu.RUnlock()
		go s.markReadyWhenPreKeysSynced(cli)

	case *events.OfflineSyncCompleted:
		s.addLog(fmt.Sprintf("Sinkronisasi offline & kunci sesi WhatsApp selesai (%d event).", e.Count))

	case *events.IdentityChange:
		s.addLog(fmt.Sprintf("Pembaruan kunci identitas device %s (implicit=%v).", e.JID.String(), e.Implicit))

	case *events.Receipt:
		if e.Type == types.ReceiptTypeRetry {
			s.addLog(fmt.Sprintf("Permintaan retry dekripsi dari %s untuk ID: %s", e.Sender.String(), strings.Join(e.MessageIDs, ",")))
		}

	case *events.Disconnected:
		s.mu.Lock()
		s.state = StateDisconnected
		s.addLogLocked("Koneksi terputus (DISCONNECTED). Mencoba menghubungkan kembali dalam 3 detik...")
		shouldReconnect := !s.isLoggingOut
		cli := s.client
		s.mu.Unlock()
		if shouldReconnect {
			go func() {
				time.Sleep(3 * time.Second)
				if cli != nil && !cli.IsConnected() {
					_ = cli.Connect()
				}
			}()
		}

	case *events.LoggedOut:
		s.mu.Lock()
		s.state = StateDisconnected
		s.latestQR = ""
		s.addLogLocked("Sesi WhatsApp di-logout dari perangkat HP.")
		s.mu.Unlock()
	}
}

// -----------------------------------------------------------------------------
// Delivery & Group Helpers
// -----------------------------------------------------------------------------

func (s *WAServer) ensureConnectedClient() (*whatsmeow.Client, bool) {
	s.mu.RLock()
	cli := s.client
	loggingOut := s.isLoggingOut
	s.mu.RUnlock()

	if cli == nil || loggingOut || !cli.IsLoggedIn() {
		return nil, false
	}
	if !cli.IsConnected() {
		if !cli.WaitForConnection(5 * time.Second) {
			return nil, false
		}
	}
	return cli, cli.IsConnected() && cli.IsLoggedIn()
}

func (s *WAServer) sendPreparedTextMessage(
	ctx context.Context,
	cli *whatsmeow.Client,
	rawTarget string,
	text string,
) (types.JID, error) {
	targetJID, aliases, err := resolveJIDWithClient(ctx, cli, rawTarget)
	if err != nil {
		return types.EmptyJID, err
	}

	warmAliases := warmRecipientSessions(ctx, cli, targetJID)
	allAliases := make([]types.JID, 0, len(aliases)+len(warmAliases))
	allAliases = append(allAliases, aliases...)
	allAliases = append(allAliases, warmAliases...)

	msgID := cli.GenerateMessageID()
	msg := &waE2E.Message{
		Conversation: proto.String(text),
	}

	if s.retryCache != nil {
		s.retryCache.Store(targetJID, allAliases, msgID, msg)
	}

	sendCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	_, sendErr := cli.SendMessage(sendCtx, targetJID, msg, whatsmeow.SendRequestExtra{
		ID: msgID,
	})
	return targetJID, sendErr
}

func (s *WAServer) refreshGroups(ctx context.Context) error {
	s.mu.RLock()
	cli := s.client
	connected := cli != nil && cli.IsConnected()
	s.mu.RUnlock()

	if !connected {
		return errors.New("WhatsApp belum terhubung")
	}

	s.addLog("Mengambil daftar grup WhatsApp...")
	groups, err := cli.GetJoinedGroups(ctx)
	if err != nil {
		s.addLog(fmt.Sprintf("Gagal mengambil daftar grup: %v", err))
		return err
	}

	list := make([]GroupItem, 0, len(groups))
	for _, g := range groups {
		list = append(list, GroupItem{
			ID:   g.JID.String(),
			Name: g.Name,
		})
	}

	s.mu.Lock()
	s.groupsCache = list
	s.groupsCacheTime = time.Now()
	s.mu.Unlock()

	s.addLog(fmt.Sprintf("%d grup WhatsApp berhasil didapatkan.", len(list)))
	return nil
}

// -----------------------------------------------------------------------------
// HTTP Handlers
// -----------------------------------------------------------------------------

func (s *WAServer) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (s *WAServer) writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func (s *WAServer) handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	var qrVal *string
	if s.state == StateQRReady && s.latestQR != "" {
		qrVal = &s.latestQR
	}

	logsCopy := make([]string, len(s.logs))
	copy(logsCopy, s.logs)

	s.writeJSON(w, http.StatusOK, map[string]interface{}{
		"status": string(s.state),
		"qr":     qrVal,
		"logs":   logsCopy,
	})
}

func (s *WAServer) handleGroups(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	s.mu.RLock()
	state := s.state
	cached := s.groupsCache
	cacheTime := s.groupsCacheTime
	logsCopy := make([]string, len(s.logs))
	copy(logsCopy, s.logs)
	s.mu.RUnlock()

	if state != StateConnected {
		s.writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
			"error": "WA belum terhubung",
			"logs":  logsCopy,
		})
		return
	}

	if len(cached) == 0 || time.Since(cacheTime) > 5*time.Minute {
		_ = s.refreshGroups(r.Context())
		s.mu.RLock()
		cached = s.groupsCache
		s.mu.RUnlock()
	}

	s.writeJSON(w, http.StatusOK, map[string]interface{}{
		"groups": cached,
		"logs":   logsCopy,
	})
}

func (s *WAServer) handleGroupsRefresh(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	s.mu.RLock()
	state := s.state
	logsCopy := make([]string, len(s.logs))
	copy(logsCopy, s.logs)
	s.mu.RUnlock()

	if state != StateConnected {
		s.writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
			"error": "WA belum terhubung",
			"logs":  logsCopy,
		})
		return
	}

	err := s.refreshGroups(r.Context())
	if err != nil {
		s.writeJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"error": err.Error(),
			"logs":  logsCopy,
		})
		return
	}

	s.mu.RLock()
	cached := s.groupsCache
	s.mu.RUnlock()

	s.writeJSON(w, http.StatusOK, map[string]interface{}{
		"groups": cached,
		"logs":   logsCopy,
	})
}

func (s *WAServer) handleSend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	cli, ready := s.ensureConnectedClient()
	if !ready {
		s.writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "WA belum terhubung"})
		return
	}

	var req SendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Payload JSON tidak valid"})
		return
	}

	if req.GroupID == "" || req.Message == "" {
		s.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "group_id dan message wajib diisi"})
		return
	}

	targetJID, err := s.sendPreparedTextMessage(r.Context(), cli, req.GroupID, req.Message)
	if err != nil {
		status := http.StatusInternalServerError
		if targetJID.IsEmpty() {
			status = http.StatusBadRequest
		}
		s.addLog(fmt.Sprintf("Gagal mengirim pesan ke %s: %v", req.GroupID, err))
		s.writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}

	s.addLog(fmt.Sprintf("Pesan berhasil dikirim ke %s", targetJID))
	s.writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok":       true,
		"group_id": targetJID.String(),
	})
}

func (s *WAServer) handleBroadcast(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	cli, ready := s.ensureConnectedClient()
	if !ready {
		s.writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "WA belum terhubung"})
		return
	}

	var req BroadcastRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Payload JSON tidak valid"})
		return
	}

	if len(req.Targets) == 0 {
		s.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "targets harus array dan tidak boleh kosong"})
		return
	}

	delayMs := req.DelayMS
	if delayMs <= 0 {
		delayMs = 1500
	}
	delay := time.Duration(delayMs) * time.Millisecond

	s.addLog(fmt.Sprintf("Memulai broadcast ke %d target (delay: %dms)...", len(req.Targets), delayMs))

	results := make([]TargetResultItem, 0, len(req.Targets))
	successCount := 0
	failedCount := 0

	for i, t := range req.Targets {
		rawTarget := t.GroupID
		if rawTarget == "" {
			rawTarget = t.JID
		}

		targetJID, sendErr := s.sendPreparedTextMessage(r.Context(), cli, rawTarget, t.Message)
		if sendErr != nil {
			failedCount++
			jidStr := ""
			if !targetJID.IsEmpty() {
				jidStr = targetJID.String()
			}
			results = append(results, TargetResultItem{
				GroupID: rawTarget,
				JID:     jidStr,
				OK:      false,
				Error:   sendErr.Error(),
			})
			s.addLog(fmt.Sprintf("[%d/%d] Broadcast gagal ke %s: %v", i+1, len(req.Targets), rawTarget, sendErr))
		} else {
			successCount++
			results = append(results, TargetResultItem{
				GroupID: rawTarget,
				JID:     targetJID.String(),
				OK:      true,
			})
			s.addLog(fmt.Sprintf("[%d/%d] Broadcast terkirim ke %s", i+1, len(req.Targets), targetJID))
		}

		if i < len(req.Targets)-1 && delay > 0 {
			time.Sleep(delay)
		}
	}

	s.addLog(fmt.Sprintf("Broadcast selesai: %d sukses, %d gagal.", successCount, failedCount))

	resp := BroadcastResponse{
		OK:      failedCount == 0,
		Total:   len(req.Targets),
		Success: successCount,
		Failed:  failedCount,
		Results: results,
	}

	s.writeJSON(w, http.StatusOK, resp)
}

func (s *WAServer) handleLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	s.addLog("Melakukan logout WhatsApp...")

	s.mu.Lock()
	s.isLoggingOut = true
	cli := s.client
	s.state = StateDisconnected
	s.latestQR = ""
	s.groupsCache = nil
	s.mu.Unlock()

	if cli != nil {
		_ = cli.Logout(r.Context())
		cli.Disconnect()
	}

	s.addLog("Logout selesai & sesi dibersihkan.")

	// Jadwalkan inisialisasi ulang otomatis untuk meminta QR baru
	go func() {
		time.Sleep(1 * time.Second)
		s.mu.Lock()
		s.isLoggingOut = false
		s.mu.Unlock()
		_ = s.startConnection(context.Background())
	}()

	s.writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// -----------------------------------------------------------------------------
// Main Entry Point
// -----------------------------------------------------------------------------

func main() {
	portFlag := flag.Int("port", 3579, "Port listening untuk WA Sidecar Server")
	dbFlag := flag.String("db", "wa_session.db", "Path file database SQLite session whatsmeow")
	flag.Parse()

	log.Printf("==================================================================")
	log.Printf("🚀 WHATSMEOW WA SIDECAR SERVER (GOLANG CORE)")
	log.Printf("==================================================================")
	log.Printf("Port: %d | Database Session: %s", *portFlag, *dbFlag)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	server := NewWAServer(*portFlag, *dbFlag)
	if err := server.initClient(ctx); err != nil {
		log.Fatalf("Fatal: Gagal inisialisasi client Whatsmeow: %v", err)
	}

	// Auto-connect on startup
	go func() {
		time.Sleep(500 * time.Millisecond)
		if err := server.startConnection(ctx); err != nil {
			log.Printf("Catatan saat inisiasi koneksi awal: %v", err)
		}
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/status", server.handleStatus)
	mux.HandleFunc("/groups", server.handleGroups)
	mux.HandleFunc("/groups/refresh", server.handleGroupsRefresh)
	mux.HandleFunc("/send", server.handleSend)
	mux.HandleFunc("/broadcast", server.handleBroadcast)
	mux.HandleFunc("/logout", server.handleLogout)

	addr := fmt.Sprintf("127.0.0.1:%d", *portFlag)
	httpServer := &http.Server{
		Addr:    addr,
		Handler: server.corsMiddleware(mux),
	}

	// Graceful shutdown
	shutdownChan := make(chan os.Signal, 1)
	signal.Notify(shutdownChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-shutdownChan
		log.Println("\n🛑 Menghentikan Whatsmeow WA Server...")
		ctxTimeout, cancelTimeout := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancelTimeout()
		_ = httpServer.Shutdown(ctxTimeout)
	}()

	log.Printf("📡 WA Server berjalan di http://%s", addr)
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server listen error: %v", err)
	}
}

