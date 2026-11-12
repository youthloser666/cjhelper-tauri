package main

import (
	"testing"

	"go.mau.fi/whatsmeow/types"
)

func TestClassifyTargetInputNormalizationAndGroupDetection(t *testing.T) {
	tests := []struct {
		name          string
		input         string
		wantServer    string
		wantUser      string
		wantPhoneFlag bool
		wantErr       bool
	}{
		{
			name:          "local 08 number",
			input:         "0812-3456-7890",
			wantServer:    types.DefaultUserServer,
			wantUser:      "6281234567890",
			wantPhoneFlag: true,
		},
		{
			name:          "+62 formatted number",
			input:         "+62 812 3456 7890",
			wantServer:    types.DefaultUserServer,
			wantUser:      "6281234567890",
			wantPhoneFlag: true,
		},
		{
			name:          "leading 8 short number",
			input:         "81234567890",
			wantServer:    types.DefaultUserServer,
			wantUser:      "6281234567890",
			wantPhoneFlag: true,
		},
		{
			name:       "explicit group suffix",
			input:      "120363012345678901@g.us",
			wantServer: types.GroupServer,
			wantUser:   "120363012345678901",
		},
		{
			name:       "legacy dash group JID",
			input:      "628123456-1600000000",
			wantServer: types.GroupServer,
			wantUser:   "628123456-1600000000",
		},
		{
			name:       "18+ digit 120363 group id without suffix",
			input:      "120363098765432109",
			wantServer: types.GroupServer,
			wantUser:   "120363098765432109",
		},
		{
			name:    "empty rejects cleanly",
			input:   "   ",
			wantErr: true,
		},
		{
			name:    "short phone rejects cleanly",
			input:   "08123",
			wantErr: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			jid, isPhone, _, err := classifyTargetInput(tc.input)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error for %q", tc.input)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error for %q: %v", tc.input, err)
			}
			if jid.Server != tc.wantServer || jid.User != tc.wantUser {
				t.Fatalf("got %s (%s@%s), want %s@%s", jid.String(), jid.User, jid.Server, tc.wantUser, tc.wantServer)
			}
			if isPhone != tc.wantPhoneFlag {
				t.Fatalf("got isPhone=%v, want %v", isPhone, tc.wantPhoneFlag)
			}
		})
	}
}

