package main

import (
	"testing"
	"time"

	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

func TestSentMessageCacheDirectAndPNToLIDLookup(t *testing.T) {
	now := time.Date(2026, 11, 12, 10, 0, 0, 0, time.UTC)
	cache := NewSentMessageCache(100, time.Hour)
	cache.nowFn = func() time.Time { return now }

	pnJID := types.NewJID("6281234567890", types.DefaultUserServer)
	lidJID := types.NewJID("123456789012345", types.HiddenUserServer)
	msg := &waE2E.Message{Conversation: proto.String("Test E2EE payload")}

	cache.Store(pnJID, []types.JID{lidJID}, "MSG-1", msg)

	// Direct AD companion device lookup (Desktop/WA Web device :2)
	companionRequester := types.JID{User: "6281234567890", Device: 2, Server: types.DefaultUserServer}
	got := cache.Lookup(companionRequester, pnJID, "MSG-1", nil)
	if got == nil || got.GetConversation() != "Test E2EE payload" {
		t.Fatalf("expected retry cache hit for companion AD requester, got %v", got)
	}

	// Cross PN<->LID alias lookup when WhatsApp retry receipt references LID JID
	gotAlias := cache.Lookup(lidJID, lidJID, "MSG-1", nil)
	if gotAlias == nil || gotAlias.GetConversation() != "Test E2EE payload" {
		t.Fatalf("expected retry cache hit via stored LID alias, got %v", gotAlias)
	}

	// Dynamic alias resolver lookup when requester swapped to LID after send
	cache.Store(pnJID, nil, "MSG-2", msg)
	gotDynamic := cache.Lookup(lidJID, lidJID, "MSG-2", func(j types.JID) []types.JID {
		if j.User == lidJID.User {
			return []types.JID{pnJID}
		}
		return nil
	})
	if gotDynamic == nil {
		t.Fatalf("expected dynamic PN<->LID resolver to recover MSG-2")
	}
}

func TestSentMessageCacheBoundedEvictionAndTTLExpiration(t *testing.T) {
	now := time.Date(2026, 11, 12, 10, 0, 0, 0, time.UTC)
	cache := NewSentMessageCache(2, 30*time.Minute)
	cache.nowFn = func() time.Time { return now }

	jid := types.NewJID("6281111111111", types.DefaultUserServer)
	msg := &waE2E.Message{Conversation: proto.String("bounded")}

	cache.Store(jid, nil, "M1", msg)
	cache.Store(jid, nil, "M2", msg)
	cache.Store(jid, nil, "M3", msg)

	if cache.Lookup(jid, jid, "M1", nil) != nil {
		t.Fatalf("expected M1 to be evicted when capacity exceeded 2")
	}
	if cache.Lookup(jid, jid, "M3", nil) == nil {
		t.Fatalf("expected newest M3 to remain cached")
	}

	now = now.Add(31 * time.Minute)
	if cache.Lookup(jid, jid, "M3", nil) != nil {
		t.Fatalf("expected M3 to expire after 30m TTL")
	}
}

