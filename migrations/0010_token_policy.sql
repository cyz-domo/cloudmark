ALTER TABLE collections ADD COLUMN token_policy TEXT NOT NULL DEFAULT '{"minLength":8,"requireUppercase":true,"requireLowercase":true,"requireDigit":true,"allowAt":true}';
