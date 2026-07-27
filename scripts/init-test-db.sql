-- Runs once on first container init (empty data volume).
-- Creates the isolated database used by the pytest suite.
CREATE DATABASE taxvault_test OWNER taxvault;
