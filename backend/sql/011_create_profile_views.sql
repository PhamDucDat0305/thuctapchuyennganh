/* Run once in SSMS with job_viet selected. */
IF OBJECT_ID(N'dbo.users', N'U') IS NULL OR OBJECT_ID(N'dbo.companies', N'U') IS NULL
    THROW 50013, N'Không tìm thấy dbo.users hoặc dbo.companies. Hãy chọn đúng database job_viet.', 1;
GO

IF OBJECT_ID(N'dbo.profile_views', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.profile_views (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_profile_views PRIMARY KEY,
        employer_id BIGINT NOT NULL,
        candidate_id BIGINT NOT NULL,
        viewed_on DATE NOT NULL CONSTRAINT DF_profile_views_viewed_on DEFAULT (CONVERT(date, SYSUTCDATETIME())),
        viewed_at DATETIME2(0) NOT NULL CONSTRAINT DF_profile_views_viewed_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT CK_profile_views_distinct_users CHECK (employer_id <> candidate_id),
        CONSTRAINT FK_profile_views_employer FOREIGN KEY (employer_id) REFERENCES dbo.users(id),
        CONSTRAINT FK_profile_views_candidate FOREIGN KEY (candidate_id) REFERENCES dbo.users(id)
    );
    PRINT N'Đã tạo dbo.profile_views.';
END
ELSE
    PRINT N'dbo.profile_views đã tồn tại; không thay đổi.';
GO

/* Upgrade an existing table and retain every recorded view. */
IF COL_LENGTH(N'dbo.profile_views', N'viewed_at') IS NULL
    THROW 50014, N'Bảng dbo.profile_views thiếu viewed_at; cần kiểm tra schema trước khi nâng cấp.', 1;
GO

IF COL_LENGTH(N'dbo.profile_views', N'viewed_on') IS NULL
BEGIN
    EXEC sys.sp_executesql N'ALTER TABLE dbo.profile_views ADD viewed_on DATE NULL;';
    PRINT N'Đã thêm dbo.profile_views.viewed_on.';
END
GO

IF COL_LENGTH(N'dbo.profile_views', N'viewed_on') IS NOT NULL
    EXEC sys.sp_executesql N'
        UPDATE dbo.profile_views
        SET viewed_on = CONVERT(date, COALESCE(viewed_at, SYSUTCDATETIME()))
        WHERE viewed_on IS NULL;
    ';
GO

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.profile_views')
      AND name = N'viewed_on'
      AND is_nullable = 1
)
    EXEC sys.sp_executesql N'ALTER TABLE dbo.profile_views ALTER COLUMN viewed_on DATE NOT NULL;';
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints AS dc
    INNER JOIN sys.columns AS c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID(N'dbo.profile_views') AND c.name = N'viewed_on'
)
    EXEC sys.sp_executesql N'ALTER TABLE dbo.profile_views ADD CONSTRAINT DF_profile_views_viewed_on DEFAULT (CONVERT(date, SYSUTCDATETIME())) FOR viewed_on;';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.profile_views') AND name = N'IX_profile_views_candidate_employer_day')
    EXEC sys.sp_executesql N'CREATE INDEX IX_profile_views_candidate_employer_day ON dbo.profile_views(candidate_id, employer_id, viewed_on);';
GO

SELECT c.name AS column_name, TYPE_NAME(c.user_type_id) AS data_type
FROM sys.columns AS c
WHERE c.object_id = OBJECT_ID(N'dbo.profile_views')
ORDER BY c.column_id;
GO
