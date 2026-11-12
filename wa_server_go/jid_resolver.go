package main

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
)

var (
	groupDashPattern = regexp.MustCompile(`^\d+-\d+$`)
	nonDigitPattern  = regexp.MustCompile(`\D`)
)

// classifyTargetInput parses raw group JIDs, legacy group formats, or Indonesian phone numbers
// without requiring a live WhatsApp network client.
func classifyTargetInput(raw string) (parsed types.JID, isDirectPhone bool, normalizedPhone string, err error) {
	input := strings.TrimSpace(raw)
	if input == "" {
		return types.EmptyJID, false, "", errors.New("JID kosong")
	}

	if strings.HasSuffix(input, "@"+types.GroupServer) ||
		strings.HasSuffix(input, "@"+types.HiddenUserServer) ||
		strings.HasSuffix(input, "@"+types.NewsletterServer) ||
		strings.HasSuffix(input, "@"+types.DefaultUserServer) {
		j, parseErr := types.ParseJID(input)
		return j, false, "", parseErr
	}

	if groupDashPattern.MatchString(input) {
		return types.NewJID(input, types.GroupServer), false, "", nil
	}

	digitsOnly := nonDigitPattern.ReplaceAllString(input, "")
	if len(digitsOnly) >= 18 && strings.HasPrefix(digitsOnly, "120363") {
		return types.NewJID(digitsOnly, types.GroupServer), false, "", nil
	}

	phone := digitsOnly
	if strings.HasPrefix(phone, "0062") {
		phone = "62" + phone[4:]
	} else if strings.HasPrefix(phone, "620") {
		phone = "62" + phone[3:]
	} else if strings.HasPrefix(phone, "0") {
		phone = "62" + phone[1:]
	} else if strings.HasPrefix(phone, "8") {
		phone = "62" + phone
	}

	if len(phone) < 8 {
		return types.EmptyJID, false, "", fmt.Errorf("Nomor tidak valid: %s", raw)
	}

	return types.NewJID(phone, types.DefaultUserServer), true, phone, nil
}

func resolveAliasJIDs(ctx context.Context, cli *whatsmeow.Client, target types.JID) []types.JID {
	if cli == nil || cli.Store == nil || cli.Store.LIDs == nil || target.IsEmpty() {
		return nil
	}

	nonAD := target.ToNonAD()
	aliases := make([]types.JID, 0, 2)
	if nonAD.Server == types.DefaultUserServer {
		if lid, err := cli.Store.LIDs.GetLIDForPN(ctx, nonAD); err == nil && !lid.IsEmpty() {
			aliases = append(aliases, lid.ToNonAD())
		}
	} else if nonAD.Server == types.HiddenUserServer {
		if pn, err := cli.Store.LIDs.GetPNForLID(ctx, nonAD); err == nil && !pn.IsEmpty() {
			aliases = append(aliases, pn.ToNonAD())
		}
	}
	return aliases
}

func resolveJIDWithClient(ctx context.Context, cli *whatsmeow.Client, raw string) (types.JID, []types.JID, error) {
	targetJID, isDirectPhone, phone, err := classifyTargetInput(raw)
	if err != nil {
		return types.EmptyJID, nil, err
	}

	if cli != nil && cli.IsConnected() {
		if isDirectPhone {
			resp, checkErr := cli.IsOnWhatsApp(ctx, []string{"+" + phone})
			if checkErr == nil && len(resp) > 0 && resp[0].IsIn && !resp[0].JID.IsEmpty() {
				targetJID = resp[0].JID
			}
		}
		aliases := resolveAliasJIDs(ctx, cli, targetJID)
		return targetJID, aliases, nil
	}

	return targetJID, nil, nil
}

// warmRecipientSessions refreshes group participant lists or individual companion device keys
// prior to Signal encryption so Mobile, Desktop, and WA Web clients receive decryptable payloads.
func warmRecipientSessions(ctx context.Context, cli *whatsmeow.Client, target types.JID) []types.JID {
	if cli == nil || !cli.IsConnected() || target.IsEmpty() {
		return nil
	}

	warmCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	aliases := resolveAliasJIDs(warmCtx, cli, target)

	if target.Server == types.GroupServer {
		groupInfo, err := cli.GetGroupInfo(warmCtx, target)
		if err == nil && groupInfo != nil && len(groupInfo.Participants) > 0 {
			participants := make([]types.JID, 0, len(groupInfo.Participants)*2)
			for _, participant := range groupInfo.Participants {
				if !participant.JID.IsEmpty() {
					participants = append(participants, participant.JID.ToNonAD())
				}
				if !participant.PhoneNumber.IsEmpty() {
					participants = append(participants, participant.PhoneNumber.ToNonAD())
				}
				if !participant.LID.IsEmpty() {
					participants = append(participants, participant.LID.ToNonAD())
				}
			}
			if len(participants) > 0 {
				_, _ = cli.GetUserDevices(warmCtx, participants)
			}
		}
		return aliases
	}

	if target.Server == types.DefaultUserServer || target.Server == types.HiddenUserServer {
		targets := make([]types.JID, 0, 1+len(aliases))
		targets = append(targets, target.ToNonAD())
		targets = append(targets, aliases...)
		_, _ = cli.GetUserDevices(warmCtx, targets)
	}

	return aliases
}
