/* Run once in SSMS with job_viet selected. */
IF OBJECT_ID(N'dbo.applications', N'U') IS NULL
    THROW 50002, N'Không tìm thấy dbo.applications. Hãy tạo bảng applications trước.', 1;
GO

IF OBJECT_ID(N'dbo.interviews', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.interviews (
        id BIGINT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_interviews PRIMARY KEY,
        application_id BIGINT NOT NULL,
        interview_date DATE NOT NULL,
        interview_time TIME(0) NOT NULL,
        scheduled_at DATETIME2(0) NOT NULL,
        interview_type NVARCHAR(20) NOT NULL,
        notes NVARCHAR(2000) NULL,
        created_at DATETIME2(0) NOT NULL
            CONSTRAINT DF_interviews_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2(0) NOT NULL
            CONSTRAINT DF_interviews_updated_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_interviews_application UNIQUE (application_id),
        CONSTRAINT CK_interviews_type CHECK (interview_type IN (N'online', N'offline')),
        CONSTRAINT FK_interviews_application FOREIGN KEY (application_id)
            REFERENCES dbo.applications(id) ON DELETE CASCADE
    );
    PRINT N'Đã tạo dbo.interviews.';
END
ELSE
    PRINT N'dbo.interviews đã tồn tại; không thay đổi.';
GO

SELECT name FROM sys.tables WHERE name = N'interviews' AND schema_id = SCHEMA_ID(N'dbo');
GO
