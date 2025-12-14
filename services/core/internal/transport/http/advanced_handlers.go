package http

import (
	"encoding/json"
	"net/http"

	"core/internal/billing"
	"core/internal/cdp"
	"core/internal/fraud"
	"core/internal/inbox"
	"core/internal/onboarding"
	"core/internal/rma"
	"core/internal/tenant"
	"core/internal/visualsearch"
)

// AdvancedHandlers contains handlers for advanced platform features
type AdvancedHandlers struct {
	tenant       *tenant.TenantService
	billing      *billing.BillingService
	onboarding   *onboarding.OnboardingService
	rma          *rma.RMAService
	cdp          *cdp.CDPService
	inbox        *inbox.InboxService
	visualSearch *visualsearch.VisualSearchService
	fraud        *fraud.FraudService
}

// NewAdvancedHandlers creates new advanced handlers
func NewAdvancedHandlers() *AdvancedHandlers {
	return &AdvancedHandlers{}
}

// SetServices sets all advanced services
func (h *AdvancedHandlers) SetTenantService(s *tenant.TenantService)           { h.tenant = s }
func (h *AdvancedHandlers) SetBillingService(s *billing.BillingService)         { h.billing = s }
func (h *AdvancedHandlers) SetOnboardingService(s *onboarding.OnboardingService) { h.onboarding = s }
func (h *AdvancedHandlers) SetRMAService(s *rma.RMAService)                     { h.rma = s }
func (h *AdvancedHandlers) SetCDPService(s *cdp.CDPService)                     { h.cdp = s }
func (h *AdvancedHandlers) SetInboxService(s *inbox.InboxService)               { h.inbox = s }
func (h *AdvancedHandlers) SetVisualSearchService(s *visualsearch.VisualSearchService) { h.visualSearch = s }
func (h *AdvancedHandlers) SetFraudService(s *fraud.FraudService)               { h.fraud = s }

// RegisterRoutes registers all advanced routes
func (h *AdvancedHandlers) RegisterRoutes(mux *http.ServeMux) {
	// Tenant Management
	mux.HandleFunc("GET /api/v1/tenants", h.ListTenants)
	mux.HandleFunc("POST /api/v1/tenants", h.CreateTenant)
	mux.HandleFunc("GET /api/v1/tenants/{id}", h.GetTenant)
	mux.HandleFunc("PUT /api/v1/tenants/{id}", h.UpdateTenant)
	mux.HandleFunc("DELETE /api/v1/tenants/{id}", h.DeleteTenant)
	mux.HandleFunc("GET /api/v1/tenants/{id}/usage", h.GetTenantUsage)

	// Billing
	mux.HandleFunc("GET /api/v1/billing/plans", h.ListPlans)
	mux.HandleFunc("GET /api/v1/billing/subscription", h.GetSubscription)
	mux.HandleFunc("POST /api/v1/billing/subscription", h.CreateSubscription)
	mux.HandleFunc("PUT /api/v1/billing/subscription", h.UpdateSubscription)
	mux.HandleFunc("DELETE /api/v1/billing/subscription", h.CancelSubscription)
	mux.HandleFunc("GET /api/v1/billing/invoices", h.ListInvoices)
	mux.HandleFunc("GET /api/v1/billing/invoices/{id}", h.GetInvoice)
	mux.HandleFunc("POST /api/v1/billing/invoices/{id}/pay", h.PayInvoice)
	mux.HandleFunc("GET /api/v1/billing/usage", h.GetUsage)

	// Onboarding
	mux.HandleFunc("POST /api/v1/onboarding", h.ProcessOnboarding)
	mux.HandleFunc("GET /api/v1/onboarding/check-slug", h.CheckSlugAvailability)
	mux.HandleFunc("POST /api/v1/onboarding/custom-domain", h.AddCustomDomain)
	mux.HandleFunc("GET /api/v1/onboarding/verify-domain", h.VerifyDomain)

	// RMA (Returns)
	mux.HandleFunc("GET /api/v1/returns", h.ListReturns)
	mux.HandleFunc("POST /api/v1/returns", h.CreateReturn)
	mux.HandleFunc("GET /api/v1/returns/{id}", h.GetReturn)
	mux.HandleFunc("PUT /api/v1/returns/{id}", h.UpdateReturn)
	mux.HandleFunc("POST /api/v1/returns/{id}/approve", h.ApproveReturn)
	mux.HandleFunc("POST /api/v1/returns/{id}/reject", h.RejectReturn)
	mux.HandleFunc("POST /api/v1/returns/{id}/refund", h.ProcessRefund)

	// CDP (Customer Data Platform)
	mux.HandleFunc("GET /api/v1/cdp/profiles", h.ListProfiles)
	mux.HandleFunc("GET /api/v1/cdp/profiles/{id}", h.GetProfile)
	mux.HandleFunc("POST /api/v1/cdp/events", h.TrackEvent)
	mux.HandleFunc("GET /api/v1/cdp/segments", h.ListSegments)
	mux.HandleFunc("POST /api/v1/cdp/segments", h.CreateSegment)
	mux.HandleFunc("GET /api/v1/cdp/segments/{id}/customers", h.GetSegmentCustomers)

	// Unified Inbox
	mux.HandleFunc("GET /api/v1/inbox/conversations", h.ListConversations)
	mux.HandleFunc("GET /api/v1/inbox/conversations/{id}", h.GetConversation)
	mux.HandleFunc("POST /api/v1/inbox/conversations/{id}/messages", h.SendMessage)
	mux.HandleFunc("PUT /api/v1/inbox/conversations/{id}/assign", h.AssignConversation)
	mux.HandleFunc("PUT /api/v1/inbox/conversations/{id}/status", h.UpdateConversationStatus)
	mux.HandleFunc("GET /api/v1/inbox/stats", h.GetInboxStats)

	// Visual Search
	mux.HandleFunc("POST /api/v1/visual-search/search", h.VisualSearch)
	mux.HandleFunc("POST /api/v1/visual-search/similar/{productId}", h.FindSimilarProducts)
	mux.HandleFunc("POST /api/v1/visual-search/index", h.IndexProductImage)
	mux.HandleFunc("DELETE /api/v1/visual-search/index/{productId}", h.RemoveFromIndex)

	// Fraud Detection
	mux.HandleFunc("POST /api/v1/fraud/check", h.CheckFraud)
	mux.HandleFunc("GET /api/v1/fraud/orders/{id}", h.GetFraudScore)
	mux.HandleFunc("GET /api/v1/fraud/rules", h.ListFraudRules)
	mux.HandleFunc("POST /api/v1/fraud/rules", h.CreateFraudRule)
	mux.HandleFunc("PUT /api/v1/fraud/rules/{id}", h.UpdateFraudRule)
}

// ==================== TENANT HANDLERS ====================

func (h *AdvancedHandlers) ListTenants(w http.ResponseWriter, r *http.Request) {
	if h.tenant == nil {
		writeError(w, http.StatusServiceUnavailable, "Tenant service not available")
		return
	}
	tenants, err := h.tenant.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, tenants)
}

func (h *AdvancedHandlers) CreateTenant(w http.ResponseWriter, r *http.Request) {
	if h.tenant == nil {
		writeError(w, http.StatusServiceUnavailable, "Tenant service not available")
		return
	}
	var input tenant.CreateTenantInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	t, err := h.tenant.Create(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, t)
}

func (h *AdvancedHandlers) GetTenant(w http.ResponseWriter, r *http.Request) {
	if h.tenant == nil {
		writeError(w, http.StatusServiceUnavailable, "Tenant service not available")
		return
	}
	id := r.PathValue("id")
	t, err := h.tenant.Get(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "Tenant not found")
		return
	}
	writeJSON(w, http.StatusOK, t)
}

func (h *AdvancedHandlers) UpdateTenant(w http.ResponseWriter, r *http.Request) {
	if h.tenant == nil {
		writeError(w, http.StatusServiceUnavailable, "Tenant service not available")
		return
	}
	id := r.PathValue("id")
	var input tenant.UpdateTenantInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	t, err := h.tenant.Update(r.Context(), id, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, t)
}

func (h *AdvancedHandlers) DeleteTenant(w http.ResponseWriter, r *http.Request) {
	if h.tenant == nil {
		writeError(w, http.StatusServiceUnavailable, "Tenant service not available")
		return
	}
	id := r.PathValue("id")
	if err := h.tenant.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AdvancedHandlers) GetTenantUsage(w http.ResponseWriter, r *http.Request) {
	if h.tenant == nil {
		writeError(w, http.StatusServiceUnavailable, "Tenant service not available")
		return
	}
	id := r.PathValue("id")
	usage, err := h.tenant.GetUsage(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, usage)
}

// ==================== BILLING HANDLERS ====================

func (h *AdvancedHandlers) ListPlans(w http.ResponseWriter, r *http.Request) {
	plans := billing.GetAvailablePlans()
	writeJSON(w, http.StatusOK, plans)
}

func (h *AdvancedHandlers) GetSubscription(w http.ResponseWriter, r *http.Request) {
	if h.billing == nil {
		writeError(w, http.StatusServiceUnavailable, "Billing service not available")
		return
	}
	tenantID := getTenantID(r)
	sub, err := h.billing.GetSubscription(r.Context(), tenantID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Subscription not found")
		return
	}
	writeJSON(w, http.StatusOK, sub)
}

func (h *AdvancedHandlers) CreateSubscription(w http.ResponseWriter, r *http.Request) {
	if h.billing == nil {
		writeError(w, http.StatusServiceUnavailable, "Billing service not available")
		return
	}
	var req struct {
		PlanID string `json:"plan_id"`
		Period string `json:"period"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	tenantID := getTenantID(r)
	if err := h.billing.CreateSubscription(r.Context(), tenantID, req.PlanID, req.Period); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (h *AdvancedHandlers) UpdateSubscription(w http.ResponseWriter, r *http.Request) {
	if h.billing == nil {
		writeError(w, http.StatusServiceUnavailable, "Billing service not available")
		return
	}
	var req struct {
		PlanID string `json:"plan_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	tenantID := getTenantID(r)
	if err := h.billing.ChangePlan(r.Context(), tenantID, req.PlanID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *AdvancedHandlers) CancelSubscription(w http.ResponseWriter, r *http.Request) {
	if h.billing == nil {
		writeError(w, http.StatusServiceUnavailable, "Billing service not available")
		return
	}
	tenantID := getTenantID(r)
	if err := h.billing.CancelSubscription(r.Context(), tenantID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AdvancedHandlers) ListInvoices(w http.ResponseWriter, r *http.Request) {
	if h.billing == nil {
		writeError(w, http.StatusServiceUnavailable, "Billing service not available")
		return
	}
	tenantID := getTenantID(r)
	invoices, err := h.billing.GetInvoices(r.Context(), tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, invoices)
}

func (h *AdvancedHandlers) GetInvoice(w http.ResponseWriter, r *http.Request) {
	if h.billing == nil {
		writeError(w, http.StatusServiceUnavailable, "Billing service not available")
		return
	}
	id := r.PathValue("id")
	invoice, err := h.billing.GetInvoice(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "Invoice not found")
		return
	}
	writeJSON(w, http.StatusOK, invoice)
}

func (h *AdvancedHandlers) PayInvoice(w http.ResponseWriter, r *http.Request) {
	if h.billing == nil {
		writeError(w, http.StatusServiceUnavailable, "Billing service not available")
		return
	}
	id := r.PathValue("id")
	var req struct {
		PaymentMethodID string `json:"payment_method_id"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if err := h.billing.ProcessPayment(r.Context(), id, req.PaymentMethodID); err != nil {
		writeError(w, http.StatusPaymentRequired, err.Error())
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *AdvancedHandlers) GetUsage(w http.ResponseWriter, r *http.Request) {
	if h.billing == nil {
		writeError(w, http.StatusServiceUnavailable, "Billing service not available")
		return
	}
	tenantID := getTenantID(r)
	usage, err := h.billing.GetCurrentUsage(r.Context(), tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, usage)
}

// ==================== ONBOARDING HANDLERS ====================

func (h *AdvancedHandlers) ProcessOnboarding(w http.ResponseWriter, r *http.Request) {
	if h.onboarding == nil {
		writeError(w, http.StatusServiceUnavailable, "Onboarding service not available")
		return
	}
	var req onboarding.OnboardingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	result, err := h.onboarding.ProcessOnboarding(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, result)
}

func (h *AdvancedHandlers) CheckSlugAvailability(w http.ResponseWriter, r *http.Request) {
	if h.onboarding == nil {
		writeError(w, http.StatusServiceUnavailable, "Onboarding service not available")
		return
	}
	slug := r.URL.Query().Get("slug")
	available, err := h.onboarding.CheckSlugAvailability(r.Context(), slug)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"available": available})
}

func (h *AdvancedHandlers) AddCustomDomain(w http.ResponseWriter, r *http.Request) {
	if h.onboarding == nil {
		writeError(w, http.StatusServiceUnavailable, "Onboarding service not available")
		return
	}
	var req onboarding.AddCustomDomainInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.TenantID = getTenantID(r)
	if err := h.onboarding.AddCustomDomain(r.Context(), req); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (h *AdvancedHandlers) VerifyDomain(w http.ResponseWriter, r *http.Request) {
	if h.onboarding == nil {
		writeError(w, http.StatusServiceUnavailable, "Onboarding service not available")
		return
	}
	domain := r.URL.Query().Get("domain")
	tenantID := getTenantID(r)
	verified, instructions, err := h.onboarding.VerifyCustomDomain(r.Context(), tenantID, domain)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"verified":     verified,
		"instructions": instructions,
	})
}

// ==================== RMA HANDLERS ====================

func (h *AdvancedHandlers) ListReturns(w http.ResponseWriter, r *http.Request) {
	if h.rma == nil {
		writeError(w, http.StatusServiceUnavailable, "RMA service not available")
		return
	}
	tenantID := getTenantID(r)
	returns, err := h.rma.List(r.Context(), tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, returns)
}

func (h *AdvancedHandlers) CreateReturn(w http.ResponseWriter, r *http.Request) {
	if h.rma == nil {
		writeError(w, http.StatusServiceUnavailable, "RMA service not available")
		return
	}
	var req rma.CreateReturnInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.TenantID = getTenantID(r)
	ret, err := h.rma.Create(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, ret)
}

func (h *AdvancedHandlers) GetReturn(w http.ResponseWriter, r *http.Request) {
	if h.rma == nil {
		writeError(w, http.StatusServiceUnavailable, "RMA service not available")
		return
	}
	id := r.PathValue("id")
	ret, err := h.rma.Get(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "Return not found")
		return
	}
	writeJSON(w, http.StatusOK, ret)
}

func (h *AdvancedHandlers) UpdateReturn(w http.ResponseWriter, r *http.Request) {
	if h.rma == nil {
		writeError(w, http.StatusServiceUnavailable, "RMA service not available")
		return
	}
	id := r.PathValue("id")
	var req rma.UpdateReturnInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	ret, err := h.rma.Update(r.Context(), id, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, ret)
}

func (h *AdvancedHandlers) ApproveReturn(w http.ResponseWriter, r *http.Request) {
	if h.rma == nil {
		writeError(w, http.StatusServiceUnavailable, "RMA service not available")
		return
	}
	id := r.PathValue("id")
	if err := h.rma.Approve(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *AdvancedHandlers) RejectReturn(w http.ResponseWriter, r *http.Request) {
	if h.rma == nil {
		writeError(w, http.StatusServiceUnavailable, "RMA service not available")
		return
	}
	id := r.PathValue("id")
	var req struct {
		Reason string `json:"reason"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if err := h.rma.Reject(r.Context(), id, req.Reason); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *AdvancedHandlers) ProcessRefund(w http.ResponseWriter, r *http.Request) {
	if h.rma == nil {
		writeError(w, http.StatusServiceUnavailable, "RMA service not available")
		return
	}
	id := r.PathValue("id")
	if err := h.rma.ProcessRefund(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusOK)
}

// ==================== CDP HANDLERS ====================

func (h *AdvancedHandlers) ListProfiles(w http.ResponseWriter, r *http.Request) {
	if h.cdp == nil {
		writeError(w, http.StatusServiceUnavailable, "CDP service not available")
		return
	}
	tenantID := getTenantID(r)
	profiles, err := h.cdp.ListProfiles(r.Context(), tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, profiles)
}

func (h *AdvancedHandlers) GetProfile(w http.ResponseWriter, r *http.Request) {
	if h.cdp == nil {
		writeError(w, http.StatusServiceUnavailable, "CDP service not available")
		return
	}
	id := r.PathValue("id")
	profile, err := h.cdp.GetProfile(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "Profile not found")
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

func (h *AdvancedHandlers) TrackEvent(w http.ResponseWriter, r *http.Request) {
	if h.cdp == nil {
		writeError(w, http.StatusServiceUnavailable, "CDP service not available")
		return
	}
	var req cdp.TrackEventInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.TenantID = getTenantID(r)
	if err := h.cdp.TrackEvent(r.Context(), req); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (h *AdvancedHandlers) ListSegments(w http.ResponseWriter, r *http.Request) {
	if h.cdp == nil {
		writeError(w, http.StatusServiceUnavailable, "CDP service not available")
		return
	}
	tenantID := getTenantID(r)
	segments, err := h.cdp.ListSegments(r.Context(), tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, segments)
}

func (h *AdvancedHandlers) CreateSegment(w http.ResponseWriter, r *http.Request) {
	if h.cdp == nil {
		writeError(w, http.StatusServiceUnavailable, "CDP service not available")
		return
	}
	var req cdp.CreateSegmentInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.TenantID = getTenantID(r)
	segment, err := h.cdp.CreateSegment(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, segment)
}

func (h *AdvancedHandlers) GetSegmentCustomers(w http.ResponseWriter, r *http.Request) {
	if h.cdp == nil {
		writeError(w, http.StatusServiceUnavailable, "CDP service not available")
		return
	}
	id := r.PathValue("id")
	customers, err := h.cdp.GetSegmentCustomers(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, customers)
}

// ==================== INBOX HANDLERS ====================

func (h *AdvancedHandlers) ListConversations(w http.ResponseWriter, r *http.Request) {
	if h.inbox == nil {
		writeError(w, http.StatusServiceUnavailable, "Inbox service not available")
		return
	}
	tenantID := getTenantID(r)
	status := r.URL.Query().Get("status")
	conversations, err := h.inbox.List(r.Context(), tenantID, status)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, conversations)
}

func (h *AdvancedHandlers) GetConversation(w http.ResponseWriter, r *http.Request) {
	if h.inbox == nil {
		writeError(w, http.StatusServiceUnavailable, "Inbox service not available")
		return
	}
	id := r.PathValue("id")
	conv, err := h.inbox.Get(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "Conversation not found")
		return
	}
	writeJSON(w, http.StatusOK, conv)
}

func (h *AdvancedHandlers) SendMessage(w http.ResponseWriter, r *http.Request) {
	if h.inbox == nil {
		writeError(w, http.StatusServiceUnavailable, "Inbox service not available")
		return
	}
	id := r.PathValue("id")
	var req inbox.SendMessageInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.ConversationID = id
	msg, err := h.inbox.SendMessage(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, msg)
}

func (h *AdvancedHandlers) AssignConversation(w http.ResponseWriter, r *http.Request) {
	if h.inbox == nil {
		writeError(w, http.StatusServiceUnavailable, "Inbox service not available")
		return
	}
	id := r.PathValue("id")
	var req struct {
		AgentID string `json:"agent_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.inbox.Assign(r.Context(), id, req.AgentID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *AdvancedHandlers) UpdateConversationStatus(w http.ResponseWriter, r *http.Request) {
	if h.inbox == nil {
		writeError(w, http.StatusServiceUnavailable, "Inbox service not available")
		return
	}
	id := r.PathValue("id")
	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if err := h.inbox.UpdateStatus(r.Context(), id, req.Status); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *AdvancedHandlers) GetInboxStats(w http.ResponseWriter, r *http.Request) {
	if h.inbox == nil {
		writeError(w, http.StatusServiceUnavailable, "Inbox service not available")
		return
	}
	tenantID := getTenantID(r)
	stats, err := h.inbox.GetStats(r.Context(), tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

// ==================== VISUAL SEARCH HANDLERS ====================

func (h *AdvancedHandlers) VisualSearch(w http.ResponseWriter, r *http.Request) {
	if h.visualSearch == nil {
		writeError(w, http.StatusServiceUnavailable, "Visual search service not available")
		return
	}

	// Parse multipart form for image upload
	if err := r.ParseMultipartForm(10 << 20); err != nil { // 10 MB max
		writeError(w, http.StatusBadRequest, "Failed to parse form")
		return
	}

	file, _, err := r.FormFile("image")
	if err != nil {
		writeError(w, http.StatusBadRequest, "Image is required")
		return
	}
	defer file.Close()

	tenantID := getTenantID(r)
	results, err := h.visualSearch.SearchByImage(r.Context(), tenantID, file)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, results)
}

func (h *AdvancedHandlers) FindSimilarProducts(w http.ResponseWriter, r *http.Request) {
	if h.visualSearch == nil {
		writeError(w, http.StatusServiceUnavailable, "Visual search service not available")
		return
	}
	productID := r.PathValue("productId")
	tenantID := getTenantID(r)
	results, err := h.visualSearch.FindSimilar(r.Context(), tenantID, productID, 10)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, results)
}

func (h *AdvancedHandlers) IndexProductImage(w http.ResponseWriter, r *http.Request) {
	if h.visualSearch == nil {
		writeError(w, http.StatusServiceUnavailable, "Visual search service not available")
		return
	}
	var req struct {
		ProductID string `json:"product_id"`
		ImageURL  string `json:"image_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	tenantID := getTenantID(r)
	if err := h.visualSearch.IndexProduct(r.Context(), tenantID, req.ProductID, req.ImageURL); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (h *AdvancedHandlers) RemoveFromIndex(w http.ResponseWriter, r *http.Request) {
	if h.visualSearch == nil {
		writeError(w, http.StatusServiceUnavailable, "Visual search service not available")
		return
	}
	productID := r.PathValue("productId")
	if err := h.visualSearch.RemoveProduct(r.Context(), productID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ==================== FRAUD HANDLERS ====================

func (h *AdvancedHandlers) CheckFraud(w http.ResponseWriter, r *http.Request) {
	if h.fraud == nil {
		writeError(w, http.StatusServiceUnavailable, "Fraud service not available")
		return
	}
	var req fraud.CheckInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.TenantID = getTenantID(r)
	result, err := h.fraud.Check(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *AdvancedHandlers) GetFraudScore(w http.ResponseWriter, r *http.Request) {
	if h.fraud == nil {
		writeError(w, http.StatusServiceUnavailable, "Fraud service not available")
		return
	}
	orderID := r.PathValue("id")
	score, err := h.fraud.GetScore(r.Context(), orderID)
	if err != nil {
		writeError(w, http.StatusNotFound, "Score not found")
		return
	}
	writeJSON(w, http.StatusOK, score)
}

func (h *AdvancedHandlers) ListFraudRules(w http.ResponseWriter, r *http.Request) {
	if h.fraud == nil {
		writeError(w, http.StatusServiceUnavailable, "Fraud service not available")
		return
	}
	tenantID := getTenantID(r)
	rules, err := h.fraud.ListRules(r.Context(), tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, rules)
}

func (h *AdvancedHandlers) CreateFraudRule(w http.ResponseWriter, r *http.Request) {
	if h.fraud == nil {
		writeError(w, http.StatusServiceUnavailable, "Fraud service not available")
		return
	}
	var req fraud.CreateRuleInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	req.TenantID = getTenantID(r)
	rule, err := h.fraud.CreateRule(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, rule)
}

func (h *AdvancedHandlers) UpdateFraudRule(w http.ResponseWriter, r *http.Request) {
	if h.fraud == nil {
		writeError(w, http.StatusServiceUnavailable, "Fraud service not available")
		return
	}
	id := r.PathValue("id")
	var req fraud.UpdateRuleInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	rule, err := h.fraud.UpdateRule(r.Context(), id, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, rule)
}

// ==================== HELPERS ====================

func getTenantID(r *http.Request) string {
	// Extract tenant ID from header or context
	tenantID := r.Header.Get("X-Tenant-ID")
	if tenantID == "" {
		// Try from subdomain
		tenantID = extractTenantFromHost(r.Host)
	}
	return tenantID
}

func extractTenantFromHost(host string) string {
	// Extract subdomain from host like "mystore.shop.com"
	// Returns "mystore"
	parts := splitHost(host)
	if len(parts) >= 3 {
		return parts[0]
	}
	return ""
}

func splitHost(host string) []string {
	// Remove port if present
	for i := len(host) - 1; i >= 0; i-- {
		if host[i] == ':' {
			host = host[:i]
			break
		}
	}
	// Split by dots
	var parts []string
	var start int
	for i := 0; i < len(host); i++ {
		if host[i] == '.' {
			parts = append(parts, host[start:i])
			start = i + 1
		}
	}
	if start < len(host) {
		parts = append(parts, host[start:])
	}
	return parts
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
