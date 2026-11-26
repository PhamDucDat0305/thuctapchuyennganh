/* Idempotent schema migration for email OTP and one-time registration tokens. */
USE [job_viet];
GO

IF OBJECT_ID(N'dbo.email_verifications', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.email_verifications (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_email_verifications PRIMARY KEY,
        email NVARCHAR(255) NOT NULL,
        otp_hash VARCHAR(64) NOT NULL,
        expires_at DATETIME2 NOT NULL,
        attempt_count INT NOT NULL CONSTRAINT DF_email_verifications_attempt_count DEFAULT (0),
        last_sent_at DATETIME2 NOT NULL CONSTRAINT DF_email_verifications_last_sent_at DEFAULT (SYSUTCDATETIME()),
        verified_at DATETIME2 NULL,
        verification_token_hash VARCHAR(64) NULL,
        verification_expires_at DATETIME2 NULL,
        consumed_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_email_verifications_created_at DEFAULT (SYSUTCDATETIME())
    );
END;
GO

IF COL_LENGTH(N'dbo.email_verifications', N'email') IS NULL
   OR COL_LENGTH(N'dbo.email_verifications', N'otp_hash') IS NULL
   OR COL_LENGTH(N'dbo.email_verifications', N'expires_at') IS NULL
   OR COL_LENGTH(N'dbo.email_verifications', N'attempt_count') IS NULL
   OR COL_LENGTH(N'dbo.email_verifications', N'last_sent_at') IS NULL
   OR COL_LENGTH(N'dbo.email_verifications', N'verified_at') IS NULL
   OR COL_LENGTH(N'dbo.email_verifications', N'verification_token_hash') IS NULL
   OR COL_LENGTH(N'dbo.email_verifications', N'verification_expires_at') IS NULL
   OR COL_LENGTH(N'dbo.email_verifications', N'consumed_at') IS NULL
   OR COL_LENGTH(N'dbo.email_verifications', N'created_at') IS NULL
BEGIN
    ;THROW 51019, N'dbo.email_verifications exists but does not match the required API schema.', 1;
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.email_verifications')
      AND name = N'IX_email_verifications_email_id'
)
    CREATE INDEX IX_email_verifications_email_id
        ON dbo.email_verifications(email, id DESC);
GO

SELECT c.name AS column_name, TYPE_NAME(c.user_type_id) AS data_type,
       c.max_length, c.is_nullable
FROM sys.columns AS c
WHERE c.object_id = OBJECT_ID(N'dbo.email_verifications')
ORDER BY c.column_id;
GO
