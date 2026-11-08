/* Additive Admin MVP migration. Run once against job_viet in SSMS. */
USE [job_viet];
GO

IF COL_LENGTH(N'dbo.users', N'admin_locked') IS NULL
    ALTER TABLE dbo.users ADD admin_locked BIT NOT NULL CONSTRAINT DF_users_admin_locked DEFAULT (0) WITH VALUES;
GO

IF COL_LENGTH(N'dbo.jobs', N'admin_visibility') IS NULL
    ALTER TABLE dbo.jobs ADD admin_visibility NVARCHAR(20) NOT NULL CONSTRAINT DF_jobs_admin_visibility DEFAULT (N'visible') WITH VALUES;
GO

IF COL_LENGTH(N'dbo.companies', N'admin_status') IS NULL
    ALTER TABLE dbo.companies ADD admin_status NVARCHAR(20) NOT NULL CONSTRAINT DF_companies_admin_status DEFAULT (N'active') WITH VALUES;
GO

IF OBJECT_ID(N'dbo.admin_audit_logs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.admin_audit_logs (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_admin_audit_logs PRIMARY KEY,
        admin_id BIGINT NOT NULL,
        action NVARCHAR(80) NOT NULL,
        target_type NVARCHAR(40) NOT NULL,
        target_id BIGINT NULL,
        reason NVARCHAR(500) NULL,
        ip_address NVARCHAR(45) NULL,
        metadata_json NVARCHAR(MAX) NULL,
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_admin_audit_logs_created_at DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_admin_audit_logs_created_at ON dbo.admin_audit_logs(created_at DESC, id DESC);
    CREATE INDEX IX_admin_audit_logs_admin_id ON dbo.admin_audit_logs(admin_id, created_at DESC);
END;
GO
