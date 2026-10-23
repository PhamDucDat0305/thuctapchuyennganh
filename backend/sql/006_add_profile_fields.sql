/* Run once in SSMS with job_viet selected before using profile APIs. */
IF OBJECT_ID(N'dbo.users', N'U') IS NULL OR OBJECT_ID(N'dbo.companies', N'U') IS NULL
    THROW 50006, N'Không tìm thấy dbo.users hoặc dbo.companies trong database hiện tại. Hãy chọn job_viet.', 1;
GO

IF COL_LENGTH(N'dbo.users', N'search_status') IS NULL
    ALTER TABLE dbo.users ADD search_status BIT NOT NULL
        CONSTRAINT DF_users_search_status DEFAULT (1);
GO

IF COL_LENGTH(N'dbo.users', N'two_factor_enabled') IS NULL
    ALTER TABLE dbo.users ADD two_factor_enabled BIT NOT NULL
        CONSTRAINT DF_users_two_factor_enabled DEFAULT (0);
GO

IF OBJECT_ID(N'dbo.candidate_profiles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.candidate_profiles (
        user_id BIGINT NOT NULL CONSTRAINT PK_candidate_profiles PRIMARY KEY,
        title NVARCHAR(200) NULL,
        location NVARCHAR(200) NULL,
        experience NVARCHAR(100) NULL,
        skills NVARCHAR(MAX) NULL,
        CONSTRAINT FK_candidate_profiles_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
    );
END;
GO

IF COL_LENGTH(N'dbo.candidate_profiles', N'title') IS NULL
    ALTER TABLE dbo.candidate_profiles ADD title NVARCHAR(200) NULL;
GO
IF COL_LENGTH(N'dbo.candidate_profiles', N'location') IS NULL
    ALTER TABLE dbo.candidate_profiles ADD location NVARCHAR(200) NULL;
GO
IF COL_LENGTH(N'dbo.candidate_profiles', N'experience') IS NULL
    ALTER TABLE dbo.candidate_profiles ADD experience NVARCHAR(100) NULL;
GO
IF COL_LENGTH(N'dbo.candidate_profiles', N'skills') IS NULL
    ALTER TABLE dbo.candidate_profiles ADD skills NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH(N'dbo.companies', N'logo') IS NULL
    ALTER TABLE dbo.companies ADD logo NVARCHAR(500) NULL;
GO
IF COL_LENGTH(N'dbo.companies', N'industry') IS NULL
    ALTER TABLE dbo.companies ADD industry NVARCHAR(100) NULL;
GO
IF COL_LENGTH(N'dbo.companies', N'size') IS NULL
    ALTER TABLE dbo.companies ADD size NVARCHAR(50) NULL;
GO
IF COL_LENGTH(N'dbo.companies', N'location') IS NULL
    ALTER TABLE dbo.companies ADD location NVARCHAR(200) NULL;
GO
IF COL_LENGTH(N'dbo.companies', N'website') IS NULL
    ALTER TABLE dbo.companies ADD website NVARCHAR(500) NULL;
GO
IF COL_LENGTH(N'dbo.companies', N'description') IS NULL
    ALTER TABLE dbo.companies ADD description NVARCHAR(MAX) NULL;
GO

SELECT N'users' AS table_name, name AS column_name FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.users')
UNION ALL
SELECT N'candidate_profiles', name FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.candidate_profiles')
UNION ALL
SELECT N'companies', name FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.companies')
ORDER BY table_name, column_name;
GO
