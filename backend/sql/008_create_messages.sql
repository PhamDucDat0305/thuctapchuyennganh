/* Run once in SSMS with job_viet selected. */
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
    THROW 50008, N'Không tìm thấy dbo.users. Hãy chọn đúng database job_viet.', 1;
GO

IF OBJECT_ID(N'dbo.messages', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.messages (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_messages PRIMARY KEY,
        sender_id BIGINT NOT NULL,
        receiver_id BIGINT NOT NULL,
        content NVARCHAR(MAX) NOT NULL,
        sent_at DATETIME2(0) NOT NULL CONSTRAINT DF_messages_sent_at DEFAULT (SYSUTCDATETIME()),
        is_read BIT NOT NULL CONSTRAINT DF_messages_is_read DEFAULT (0),
        read_at DATETIME2(0) NULL,
        CONSTRAINT CK_messages_distinct_users CHECK (sender_id <> receiver_id),
        CONSTRAINT CK_messages_nonempty_content CHECK (LEN(LTRIM(RTRIM(content))) > 0),
        CONSTRAINT FK_messages_sender FOREIGN KEY (sender_id) REFERENCES dbo.users(id),
        CONSTRAINT FK_messages_receiver FOREIGN KEY (receiver_id) REFERENCES dbo.users(id)
    );
    CREATE INDEX IX_messages_sender_receiver_time
        ON dbo.messages(sender_id, receiver_id, sent_at, id);
    CREATE INDEX IX_messages_receiver_read_time
        ON dbo.messages(receiver_id, is_read, sender_id, sent_at, id);
    PRINT N'Đã tạo dbo.messages.';
END
ELSE
    PRINT N'dbo.messages đã tồn tại; không thay đổi.';
GO

/* Upgrade a table created by an earlier/incomplete version of this migration. */
IF COL_LENGTH(N'dbo.messages', N'is_read') IS NULL
BEGIN
    ALTER TABLE dbo.messages ADD is_read BIT NOT NULL
        CONSTRAINT DF_messages_is_read DEFAULT (0) WITH VALUES;
    PRINT N'Đã thêm dbo.messages.is_read.';
END;
GO

IF COL_LENGTH(N'dbo.messages', N'read_at') IS NULL
BEGIN
    ALTER TABLE dbo.messages ADD read_at DATETIME2(0) NULL;
    PRINT N'Đã thêm dbo.messages.read_at.';
END;
GO

SELECT c.name AS column_name, TYPE_NAME(c.user_type_id) AS data_type
FROM sys.columns AS c
WHERE c.object_id = OBJECT_ID(N'dbo.messages')
ORDER BY c.column_id;
GO
