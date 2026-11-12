package main

import (
	"sync"
	"time"

	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
)

type retryCacheEntry struct {
	key        string
	messageID  string
	message    *waE2E.Message
	storedAt   time.Time
	indexedKey string
}

// SentMessageCache stores recently dispatched plaintext messages so Signal retry
// receipts across primary, companion (Desktop/WA Web), and PN<->LID devices can decrypt cleanly.
type SentMessageCache struct {
	mu         sync.RWMutex
	maxEntries int
	ttl        time.Duration
	nowFn      func() time.Time
	order      []retryCacheEntry
	byJIDAndID map[string]retryCacheEntry
	byIDOnly   map[string]retryCacheEntry
}

func NewSentMessageCache(maxEntries int, ttl time.Duration) *SentMessageCache {
	if maxEntries <= 0 {
		maxEntries = 2000
	}
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}
	return &SentMessageCache{
		maxEntries: maxEntries,
		ttl:        ttl,
		nowFn:      time.Now,
		order:      make([]retryCacheEntry, 0, maxEntries),
		byJIDAndID: make(map[string]retryCacheEntry, maxEntries),
		byIDOnly:   make(map[string]retryCacheEntry, maxEntries),
	}
}

func normalizeRetryJID(jid types.JID) string {
	if jid.IsEmpty() {
		return ""
	}
	return jid.ToNonAD().String()
}

func makeRetryCompositeKey(jid types.JID, id types.MessageID) string {
	norm := normalizeRetryJID(jid)
	if norm == "" || id == "" {
		return ""
	}
	return norm + "|" + string(id)
}

func (c *SentMessageCache) Store(targetJID types.JID, aliases []types.JID, msgID types.MessageID, msg *waE2E.Message) {
	if msg == nil || msgID == "" {
		return
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	now := c.nowFn()
	c.pruneExpiredLocked(now)

	entry := retryCacheEntry{
		key:       makeRetryCompositeKey(targetJID, msgID),
		messageID: string(msgID),
		message:   msg,
		storedAt:  now,
	}

	c.byIDOnly[string(msgID)] = entry
	c.recordIndexLocked(targetJID, entry)
	for _, alias := range aliases {
		c.recordIndexLocked(alias, entry)
	}

	c.evictOverflowLocked()
}

func (c *SentMessageCache) recordIndexLocked(jid types.JID, base retryCacheEntry) {
	ck := makeRetryCompositeKey(jid, types.MessageID(base.messageID))
	if ck == "" {
		return
	}
	indexed := base
	indexed.indexedKey = ck
	c.byJIDAndID[ck] = indexed
	c.order = append(c.order, indexed)
}

func (c *SentMessageCache) Lookup(
	requester types.JID,
	to types.JID,
	id types.MessageID,
	resolveAliases func(types.JID) []types.JID,
) *waE2E.Message {
	if id == "" {
		return nil
	}

	c.mu.RLock()
	now := c.nowFn()
	candidates := make([]types.JID, 0, 6)
	if !to.IsEmpty() {
		candidates = append(candidates, to)
	}
	if !requester.IsEmpty() {
		candidates = append(candidates, requester)
	}
	if resolveAliases != nil {
		if !to.IsEmpty() {
			candidates = append(candidates, resolveAliases(to)...)
		}
		if !requester.IsEmpty() {
			candidates = append(candidates, resolveAliases(requester)...)
		}
	}

	for _, candidate := range candidates {
		ck := makeRetryCompositeKey(candidate, id)
		if ck == "" {
			continue
		}
		if entry, ok := c.byJIDAndID[ck]; ok && now.Sub(entry.storedAt) <= c.ttl {
			c.mu.RUnlock()
			return entry.message
		}
	}

	if entry, ok := c.byIDOnly[string(id)]; ok && now.Sub(entry.storedAt) <= c.ttl {
		c.mu.RUnlock()
		return entry.message
	}
	c.mu.RUnlock()
	return nil
}

func (c *SentMessageCache) pruneExpiredLocked(now time.Time) {
	if len(c.order) == 0 {
		return
	}
	cutoff := 0
	for cutoff < len(c.order) && now.Sub(c.order[cutoff].storedAt) > c.ttl {
		stale := c.order[cutoff]
		if cur, ok := c.byJIDAndID[stale.indexedKey]; ok && cur.storedAt.Equal(stale.storedAt) {
			delete(c.byJIDAndID, stale.indexedKey)
		}
		if curID, ok := c.byIDOnly[stale.messageID]; ok && curID.storedAt.Equal(stale.storedAt) {
			delete(c.byIDOnly, stale.messageID)
		}
		cutoff++
	}
	if cutoff > 0 {
		c.order = append([]retryCacheEntry(nil), c.order[cutoff:]...)
	}
}

func (c *SentMessageCache) evictOverflowLocked() {
	for len(c.order) > c.maxEntries {
		oldest := c.order[0]
		c.order = c.order[1:]
		if cur, ok := c.byJIDAndID[oldest.indexedKey]; ok && cur.storedAt.Equal(oldest.storedAt) {
			delete(c.byJIDAndID, oldest.indexedKey)
		}
		if curID, ok := c.byIDOnly[oldest.messageID]; ok && curID.storedAt.Equal(oldest.storedAt) {
			delete(c.byIDOnly, oldest.messageID)
		}
	}
}

