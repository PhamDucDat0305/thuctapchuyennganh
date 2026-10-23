/* Run once in the job_viet database before starting the API. */
IF OBJECT_ID(N'dbo.sessions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.sessions (
        sid     NVARCHAR(255) NOT NULL,
        session NVARCHAR(MAX) NOT NULL,
        expires DATETIME NOT NULL,
        CONSTRAINT pk_sessions PRIMARY KEY (sid)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.sessions')
      AND name = N'ix_sessions_expires'
)
    CREATE INDEX ix_sessions_expires ON dbo.sessions (expires);
GO
