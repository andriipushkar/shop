-- Extended Modules Schema Rollback
-- Migration: 000002_extended_modules

-- Drop triggers
DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
DROP TRIGGER IF EXISTS update_erp_integrations_updated_at ON erp_integrations;
DROP TRIGGER IF EXISTS update_marketplace_integrations_updated_at ON marketplace_integrations;
DROP TRIGGER IF EXISTS update_webhooks_updated_at ON webhooks;
DROP TRIGGER IF EXISTS update_warehouse_stock_updated_at ON warehouse_stock;
DROP TRIGGER IF EXISTS update_warehouses_updated_at ON warehouses;
DROP TRIGGER IF EXISTS update_loyalty_accounts_updated_at ON loyalty_accounts;

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS inventory_alerts;
DROP TABLE IF EXISTS file_uploads;
DROP TABLE IF EXISTS sms_logs;
DROP TABLE IF EXISTS email_logs;
DROP TABLE IF EXISTS email_templates;
DROP TABLE IF EXISTS abc_xyz_analysis;
DROP TABLE IF EXISTS rfm_analysis;
DROP TABLE IF EXISTS analytics_sales;
DROP TABLE IF EXISTS erp_sync_logs;
DROP TABLE IF EXISTS erp_integrations;
DROP TABLE IF EXISTS marketplace_sync_logs;
DROP TABLE IF EXISTS marketplace_integrations;
DROP TABLE IF EXISTS webhook_deliveries;
DROP TABLE IF EXISTS webhooks;
DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS warehouse_stock;
DROP TABLE IF EXISTS warehouses;
DROP TABLE IF EXISTS loyalty_redemptions;
DROP TABLE IF EXISTS loyalty_rewards;
DROP TABLE IF EXISTS loyalty_transactions;
DROP TABLE IF EXISTS loyalty_accounts;
