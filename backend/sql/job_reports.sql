/* Job listing report inbox for candidates and Admins. Run once in SSMS. */
USE [job_viet];
GO

IF OBJECT_ID(N'dbo.job_reports', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.job_reports (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_job_reports PRIMARY KEY,
        job_id BIGINT NOT NULL,
        reporter_id BIGINT NOT NULL,
        full_name NVARCHAR(150) NOT NULL,
        phone NVARCHAR(30) NOT NULL,
        address NVARCHAR(300) NOT NULL,
        email NVARCHAR(255) NOT NULL,
        content NVARCHAR(4000) NOT NULL,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_job_reports_status DEFAULT (N'new'),
        admin_note NVARCHAR(1000) NULL,
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_job_reports_created_at DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2(3) NULL
    );
    CREATE INDEX IX_job_reports_status_created ON dbo.job_reports(status, created_at DESC, id DESC);
    CREATE INDEX IX_job_reports_job_created ON dbo.job_reports(job_id, created_at DESC);
END;
GO
