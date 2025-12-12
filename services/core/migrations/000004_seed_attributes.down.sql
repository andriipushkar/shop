-- Rollback Seed Data for Attributes
-- Migration: 000004_seed_attributes (DOWN)

-- Delete all seed data
DELETE FROM attribute_options WHERE id LIKE 'c0000%';
DELETE FROM attributes WHERE id LIKE 'b0000%';
DELETE FROM attribute_groups WHERE id LIKE 'a0000%';
