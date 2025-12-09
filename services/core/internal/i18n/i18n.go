package i18n

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
)

//go:embed locales/*.json
var localesFS embed.FS

// Supported languages
const (
	LangUK = "uk" // Ukrainian (default)
	LangEN = "en" // English
	LangRU = "ru" // Russian
)

var supportedLanguages = map[string]bool{
	LangUK: true,
	LangEN: true,
	LangRU: true,
}

// DefaultLanguage is the default language
const DefaultLanguage = LangUK

// contextKey is the type for context keys
type contextKey string

const languageKey contextKey = "language"

// Translator handles message translation
type Translator struct {
	messages map[string]map[string]string
	mu       sync.RWMutex
}

// Message represents a translatable message
type Message struct {
	ID   string
	Args map[string]interface{}
}

// New creates a new Translator
func New() (*Translator, error) {
	t := &Translator{
		messages: make(map[string]map[string]string),
	}

	// Load embedded locale files
	for lang := range supportedLanguages {
		data, err := localesFS.ReadFile(fmt.Sprintf("locales/%s.json", lang))
		if err != nil {
			return nil, fmt.Errorf("failed to load locale %s: %w", lang, err)
		}

		var messages map[string]string
		if err := json.Unmarshal(data, &messages); err != nil {
			return nil, fmt.Errorf("failed to parse locale %s: %w", lang, err)
		}

		t.messages[lang] = messages
	}

	return t, nil
}

// Translate translates a message ID to the target language
func (t *Translator) Translate(lang, messageID string, args ...interface{}) string {
	t.mu.RLock()
	defer t.mu.RUnlock()

	// Fallback to default language if not supported
	if !supportedLanguages[lang] {
		lang = DefaultLanguage
	}

	messages, ok := t.messages[lang]
	if !ok {
		messages = t.messages[DefaultLanguage]
	}

	msg, ok := messages[messageID]
	if !ok {
		// Fallback to default language
		if lang != DefaultLanguage {
			if defMessages, ok := t.messages[DefaultLanguage]; ok {
				if defMsg, ok := defMessages[messageID]; ok {
					msg = defMsg
				}
			}
		}
		// If still not found, return the message ID
		if msg == "" {
			return messageID
		}
	}

	// Apply arguments if provided
	if len(args) > 0 {
		return fmt.Sprintf(msg, args...)
	}

	return msg
}

// T is a shorthand for Translate
func (t *Translator) T(lang, messageID string, args ...interface{}) string {
	return t.Translate(lang, messageID, args...)
}

// TranslateMap translates a message with named arguments
func (t *Translator) TranslateMap(lang, messageID string, args map[string]interface{}) string {
	t.mu.RLock()
	defer t.mu.RUnlock()

	if !supportedLanguages[lang] {
		lang = DefaultLanguage
	}

	messages, ok := t.messages[lang]
	if !ok {
		messages = t.messages[DefaultLanguage]
	}

	msg, ok := messages[messageID]
	if !ok {
		return messageID
	}

	// Replace named placeholders
	for key, value := range args {
		placeholder := fmt.Sprintf("{{%s}}", key)
		msg = strings.ReplaceAll(msg, placeholder, fmt.Sprintf("%v", value))
	}

	return msg
}

// GetSupportedLanguages returns list of supported languages
func GetSupportedLanguages() []string {
	langs := make([]string, 0, len(supportedLanguages))
	for lang := range supportedLanguages {
		langs = append(langs, lang)
	}
	return langs
}

// IsSupported checks if a language is supported
func IsSupported(lang string) bool {
	return supportedLanguages[lang]
}

// Middleware extracts language from request and adds to context
func (t *Translator) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lang := DetectLanguage(r)
		ctx := context.WithValue(r.Context(), languageKey, lang)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// DetectLanguage detects language from request
func DetectLanguage(r *http.Request) string {
	// 1. Check query parameter
	if lang := r.URL.Query().Get("lang"); lang != "" && supportedLanguages[lang] {
		return lang
	}

	// 2. Check custom header
	if lang := r.Header.Get("X-Language"); lang != "" && supportedLanguages[lang] {
		return lang
	}

	// 3. Check Accept-Language header
	acceptLang := r.Header.Get("Accept-Language")
	if acceptLang != "" {
		// Parse Accept-Language (simplified)
		langs := parseAcceptLanguage(acceptLang)
		for _, lang := range langs {
			if supportedLanguages[lang] {
				return lang
			}
		}
	}

	// 4. Check cookie
	if cookie, err := r.Cookie("lang"); err == nil && supportedLanguages[cookie.Value] {
		return cookie.Value
	}

	return DefaultLanguage
}

// GetLanguageFromContext extracts language from context
func GetLanguageFromContext(ctx context.Context) string {
	if lang, ok := ctx.Value(languageKey).(string); ok {
		return lang
	}
	return DefaultLanguage
}

// SetLanguageInContext sets language in context
func SetLanguageInContext(ctx context.Context, lang string) context.Context {
	if !supportedLanguages[lang] {
		lang = DefaultLanguage
	}
	return context.WithValue(ctx, languageKey, lang)
}

// parseAcceptLanguage parses Accept-Language header (simplified)
func parseAcceptLanguage(header string) []string {
	var langs []string
	parts := strings.Split(header, ",")
	for _, part := range parts {
		lang := strings.TrimSpace(strings.Split(part, ";")[0])
		// Normalize (e.g., "uk-UA" -> "uk")
		if idx := strings.Index(lang, "-"); idx > 0 {
			lang = lang[:idx]
		}
		langs = append(langs, strings.ToLower(lang))
	}
	return langs
}

// TranslatedError is an error that can be translated
type TranslatedError struct {
	MessageID string
	Args      map[string]interface{}
	Err       error
}

func (e *TranslatedError) Error() string {
	return e.MessageID
}

func (e *TranslatedError) Unwrap() error {
	return e.Err
}

// NewError creates a new translatable error
func NewError(messageID string, args map[string]interface{}) *TranslatedError {
	return &TranslatedError{
		MessageID: messageID,
		Args:      args,
	}
}

// WrapError wraps an error with translation
func WrapError(err error, messageID string, args map[string]interface{}) *TranslatedError {
	return &TranslatedError{
		MessageID: messageID,
		Args:      args,
		Err:       err,
	}
}

// TranslateError translates a TranslatedError
func (t *Translator) TranslateError(lang string, err error) string {
	if te, ok := err.(*TranslatedError); ok {
		return t.TranslateMap(lang, te.MessageID, te.Args)
	}
	return err.Error()
}
