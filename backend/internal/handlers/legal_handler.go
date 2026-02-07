package handlers

import "github.com/gofiber/fiber/v2"

type LegalHandler struct{}

func NewLegalHandler() *LegalHandler {
	return &LegalHandler{}
}

func (h *LegalHandler) PrivacyPolicy(c *fiber.Ctx) error {
	html := `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Privacy Policy - Daiyly</title><style>body{font-family:-apple-system,system-ui,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#333;line-height:1.6}h1{color:#F59E0B}h2{color:#D97706;margin-top:30px}</style></head><body><h1>Privacy Policy</h1><p><strong>Last updated:</strong> February 7, 2026</p><p>Daiyly ("we", "our", or "us") is committed to protecting your privacy.</p><h2>Information We Collect</h2><ul><li><strong>Account Information:</strong> Email address and encrypted password.</li><li><strong>Journal Entries:</strong> Your personal journal entries and mood data.</li><li><strong>Usage Data:</strong> App interaction data to improve services.</li></ul><h2>How We Use Your Information</h2><ul><li>To store and display your journal entries</li><li>To provide mood tracking and personal insights</li><li>To generate writing prompts</li></ul><h2>Data Storage & Security</h2><p>Your journal entries are stored securely with encryption. We use JWT authentication and encrypted connections.</p><h2>Third-Party Services</h2><ul><li><strong>RevenueCat:</strong> Subscription management.</li><li><strong>Apple Sign In:</strong> We receive only your email and name.</li></ul><h2>Data Deletion</h2><p>Delete your account and all journal entries from Settings.</p><h2>Children's Privacy</h2><p>Not intended for children under 13.</p><h2>Contact</h2><p>Email: <strong>ahmetk3436@gmail.com</strong></p></body></html>`
	c.Set("Content-Type", "text/html; charset=utf-8")
	return c.SendString(html)
}

func (h *LegalHandler) TermsOfService(c *fiber.Ctx) error {
	html := `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Terms of Service - Daiyly</title><style>body{font-family:-apple-system,system-ui,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#333;line-height:1.6}h1{color:#F59E0B}h2{color:#D97706;margin-top:30px}</style></head><body><h1>Terms of Service</h1><p><strong>Last updated:</strong> February 7, 2026</p><h2>Use of Service</h2><p>Daiyly provides daily journaling and mood tracking. You must be at least 13 years old.</p><h2>Your Content</h2><p>You retain full ownership of your journal entries. We do not share your personal writings with anyone.</p><h2>Subscriptions</h2><ul><li>Premium via Apple's App Store. Cancel anytime via Apple ID settings.</li></ul><h2>Limitation of Liability</h2><p>Daiyly is provided "as is". Not a substitute for professional mental health services.</p><h2>Contact</h2><p>Email: <strong>ahmetk3436@gmail.com</strong></p></body></html>`
	c.Set("Content-Type", "text/html; charset=utf-8")
	return c.SendString(html)
}
