/* Run once in SSMS with job_viet selected. */
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
   OR OBJECT_ID(N'dbo.companies', N'U') IS NULL
   OR OBJECT_ID(N'dbo.jobs', N'U') IS NULL
    THROW 50012, N'Không tìm thấy dbo.users, dbo.companies hoặc dbo.jobs. Hãy chọn đúng database job_viet.', 1;
GO

IF OBJECT_ID(N'dbo.invites', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.invites (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_invites PRIMARY KEY,
        employer_id BIGINT NOT NULL,
        candidate_id BIGINT NOT NULL,
        job_id BIGINT NULL,
        message NVARCHAR(1000) NULL,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_invites_status DEFAULT (N'pending'),
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_invites_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_invites_updated_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT CK_invites_status CHECK (status IN (N'pending', N'accepted', N'rejected')),
        CONSTRAINT FK_invites_employer FOREIGN KEY (employer_id) REFERENCES dbo.users(id),
        CONSTRAINT FK_invites_candidate FOREIGN KEY (candidate_id) REFERENCES dbo.users(id),
        CONSTRAINT FK_invites_job FOREIGN KEY (job_id) REFERENCES dbo.jobs(id)
    );
    CREATE INDEX IX_invites_candidate_status_created
        ON dbo.invites(candidate_id, status, created_at DESC, id DESC);
    CREATE INDEX IX_invites_employer_created
        ON dbo.invites(employer_id, created_at DESC, id DESC);
    PRINT N'Đã tạo dbo.invites.';
END
ELSE
    PRINT N'dbo.invites đã tồn tại; không thay đổi.';
GO

SELECT c.name AS column_name, TYPE_NAME(c.user_type_id) AS data_type
FROM sys.columns AS c
WHERE c.object_id = OBJECT_ID(N'dbo.invites')
ORDER BY c.column_id;
GO
