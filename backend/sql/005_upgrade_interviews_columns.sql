/*
  Upgrade a pre-existing dbo.interviews table for the current API.
  Run once in SSMS with job_viet selected. Existing/legacy columns are kept.
*/
IF OBJECT_ID(N'dbo.interviews', N'U') IS NULL
    THROW 50003, N'Không tìm thấy dbo.interviews trong database hiện tại. Hãy chọn đúng database job_viet và chạy 004_create_interviews.sql trước.', 1;
GO

IF COL_LENGTH(N'dbo.interviews', N'interview_date') IS NULL
    ALTER TABLE dbo.interviews ADD interview_date DATE NULL;
GO

IF COL_LENGTH(N'dbo.interviews', N'interview_time') IS NULL
    ALTER TABLE dbo.interviews ADD interview_time TIME(0) NULL;
GO

IF COL_LENGTH(N'dbo.interviews', N'scheduled_at') IS NULL
    ALTER TABLE dbo.interviews ADD scheduled_at DATETIME2(0) NULL;
GO

IF COL_LENGTH(N'dbo.interviews', N'interview_type') IS NULL
    ALTER TABLE dbo.interviews ADD interview_type NVARCHAR(20) NULL;
GO

IF COL_LENGTH(N'dbo.interviews', N'notes') IS NULL
    ALTER TABLE dbo.interviews ADD notes NVARCHAR(2000) NULL;
GO

IF COL_LENGTH(N'dbo.interviews', N'created_at') IS NULL
    ALTER TABLE dbo.interviews ADD created_at DATETIME2(0) NOT NULL
        CONSTRAINT DF_interviews_created_at_upgrade DEFAULT (SYSUTCDATETIME());
GO

IF COL_LENGTH(N'dbo.interviews', N'updated_at') IS NULL
    ALTER TABLE dbo.interviews ADD updated_at DATETIME2(0) NOT NULL
        CONSTRAINT DF_interviews_updated_at_upgrade DEFAULT (SYSUTCDATETIME());
GO

/* Copy values from the previous common column names, if they exist. */
IF COL_LENGTH(N'dbo.interviews', N'date') IS NOT NULL
    EXEC sys.sp_executesql N'
        UPDATE dbo.interviews
        SET interview_date = TRY_CONVERT(date, [date])
        WHERE interview_date IS NULL AND [date] IS NOT NULL;';
GO

IF COL_LENGTH(N'dbo.interviews', N'time') IS NOT NULL
    EXEC sys.sp_executesql N'
        UPDATE dbo.interviews
        SET interview_time = TRY_CONVERT(time(0), [time])
        WHERE interview_time IS NULL AND [time] IS NOT NULL;';
GO

IF COL_LENGTH(N'dbo.interviews', N'type') IS NOT NULL
    EXEC sys.sp_executesql N'
        UPDATE dbo.interviews
        SET interview_type = TRY_CONVERT(nvarchar(20), [type])
        WHERE interview_type IS NULL AND [type] IS NOT NULL;';
GO

/* Keep the legacy required scheduled_at column in sync with date + time. */
UPDATE dbo.interviews
SET scheduled_at = DATEADD(MINUTE,
    DATEDIFF(MINUTE, CONVERT(time(0), '00:00'), interview_time),
    CONVERT(datetime2(0), interview_date))
WHERE scheduled_at IS NULL
  AND interview_date IS NOT NULL
  AND interview_time IS NOT NULL;
GO

SELECT c.name AS column_name, TYPE_NAME(c.user_type_id) AS data_type,
       c.is_nullable
FROM sys.columns AS c
WHERE c.object_id = OBJECT_ID(N'dbo.interviews')
ORDER BY c.column_id;
GO
