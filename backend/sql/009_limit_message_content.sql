/* Run in SSMS with job_viet selected. This preserves existing message contents. */
IF OBJECT_ID(N'dbo.messages', N'U') IS NULL
    THROW 50009, N'Không tìm thấy dbo.messages. Hãy chạy migration 008 trước.', 1;
GO

IF COL_LENGTH(N'dbo.messages', N'content') IS NULL
    THROW 50010, N'Bảng dbo.messages thiếu cột content.', 1;
GO

/* Do not silently truncate any existing message. */
IF EXISTS (SELECT 1 FROM dbo.messages WHERE DATALENGTH(content) > 4000)
    THROW 50011, N'Có tin nhắn dài hơn 2.000 ký tự. Hãy kiểm tra/xử lý các tin này trước khi chạy lại migration.', 1;
GO

IF EXISTS (
    SELECT 1
    FROM sys.columns AS c
    WHERE c.object_id = OBJECT_ID(N'dbo.messages')
      AND c.name = N'content'
      AND (c.max_length = -1 OR c.max_length > 4000)
)
BEGIN
    ALTER TABLE dbo.messages ALTER COLUMN content NVARCHAR(2000) NOT NULL;
    PRINT N'Đã đổi dbo.messages.content thành NVARCHAR(2000).';
END
ELSE
    PRINT N'dbo.messages.content đã có giới hạn tối đa 2.000 ký tự.';
GO

SELECT c.name AS column_name, TYPE_NAME(c.user_type_id) AS data_type, c.max_length
FROM sys.columns AS c
WHERE c.object_id = OBJECT_ID(N'dbo.messages') AND c.name = N'content';
GO
