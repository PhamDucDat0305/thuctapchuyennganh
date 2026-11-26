/* Remove columns with no active application feature or code reference.
   Run after migrations 011 and 016 in database job_viet. */
USE [job_viet];
GO

SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @targets TABLE (
        table_name SYSNAME NOT NULL,
        column_name SYSNAME NOT NULL
    );
    INSERT INTO @targets(table_name, column_name)
    VALUES
        (N'users', N'firebase_uid'),
        (N'users', N'two_factor_enabled'),
        (N'profile_views', N'viewed_on');

    DECLARE @table SYSNAME, @column SYSNAME, @object_id INT, @sql NVARCHAR(MAX);
    DECLARE target_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT table_name, column_name FROM @targets;
    OPEN target_cursor;
    FETCH NEXT FROM target_cursor INTO @table, @column;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @object_id = OBJECT_ID(N'dbo.' + QUOTENAME(@table), N'U');

        IF @object_id IS NOT NULL AND COL_LENGTH(N'dbo.' + @table, @column) IS NOT NULL
        BEGIN
            /* Drop foreign keys using this column on either side. */
            SET @sql = NULL;
            SELECT @sql = (
                SELECT N'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(parent_table.schema_id)) + N'.' + QUOTENAME(parent_table.name)
                    + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N';'
                FROM sys.foreign_keys AS fk
                INNER JOIN sys.foreign_key_columns AS fkc ON fkc.constraint_object_id = fk.object_id
                INNER JOIN sys.tables AS parent_table ON parent_table.object_id = fk.parent_object_id
                INNER JOIN sys.columns AS parent_column ON parent_column.object_id = fkc.parent_object_id AND parent_column.column_id = fkc.parent_column_id
                INNER JOIN sys.columns AS referenced_column ON referenced_column.object_id = fkc.referenced_object_id AND referenced_column.column_id = fkc.referenced_column_id
                WHERE (fk.parent_object_id = @object_id AND parent_column.name = @column)
                   OR (fk.referenced_object_id = @object_id AND referenced_column.name = @column)
                GROUP BY parent_table.schema_id, parent_table.name, fk.name
                FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)');
            IF NULLIF(@sql, N'') IS NOT NULL EXEC sys.sp_executesql @sql;

            SET @sql = NULL;
            SELECT @sql = (
                SELECT N'ALTER TABLE dbo.' + QUOTENAME(@table) + N' DROP CONSTRAINT ' + QUOTENAME(cc.name) + N';'
                FROM sys.check_constraints AS cc
                WHERE cc.parent_object_id = @object_id AND cc.definition LIKE N'%' + @column + N'%'
                FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)');
            IF NULLIF(@sql, N'') IS NOT NULL EXEC sys.sp_executesql @sql;

            SET @sql = NULL;
            SELECT @sql = (
                SELECT N'ALTER TABLE dbo.' + QUOTENAME(@table) + N' DROP CONSTRAINT ' + QUOTENAME(dc.name) + N';'
                FROM sys.default_constraints AS dc
                INNER JOIN sys.columns AS c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
                WHERE dc.parent_object_id = @object_id AND c.name = @column
                FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)');
            IF NULLIF(@sql, N'') IS NOT NULL EXEC sys.sp_executesql @sql;

            IF EXISTS (
                SELECT 1 FROM sys.key_constraints AS kc
                INNER JOIN sys.index_columns AS ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
                INNER JOIN sys.columns AS c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                WHERE kc.parent_object_id = @object_id AND c.name = @column AND kc.type = N'PK'
            )
            BEGIN
                ;THROW 51019, N'Refusing to drop a primary-key column during legacy cleanup.', 1;
            END;

            SET @sql = NULL;
            SELECT @sql = (
                SELECT N'ALTER TABLE dbo.' + QUOTENAME(@table) + N' DROP CONSTRAINT ' + QUOTENAME(kc.name) + N';'
                FROM sys.key_constraints AS kc
                INNER JOIN sys.index_columns AS ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
                INNER JOIN sys.columns AS c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                WHERE kc.parent_object_id = @object_id AND c.name = @column AND kc.type = N'UQ'
                GROUP BY kc.name
                FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)');
            IF NULLIF(@sql, N'') IS NOT NULL EXEC sys.sp_executesql @sql;

            SET @sql = NULL;
            SELECT @sql = (
                SELECT N'DROP INDEX ' + QUOTENAME(i.name) + N' ON dbo.' + QUOTENAME(@table) + N';'
                FROM sys.indexes AS i
                INNER JOIN sys.index_columns AS ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
                INNER JOIN sys.columns AS c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                WHERE i.object_id = @object_id AND i.name IS NOT NULL
                  AND i.is_primary_key = 0 AND i.is_unique_constraint = 0
                  AND c.name = @column
                GROUP BY i.name
                FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)');
            IF NULLIF(@sql, N'') IS NOT NULL EXEC sys.sp_executesql @sql;

            SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@table) + N' DROP COLUMN ' + QUOTENAME(@column) + N';';
            EXEC sys.sp_executesql @sql;
            PRINT N'Dropped unused dbo.' + @table + N'.' + @column + N'.';
        END;

        FETCH NEXT FROM target_cursor INTO @table, @column;
    END;

    CLOSE target_cursor;
    DEALLOCATE target_cursor;
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF CURSOR_STATUS('local', 'target_cursor') >= 0 CLOSE target_cursor;
    IF CURSOR_STATUS('local', 'target_cursor') > -3 DEALLOCATE target_cursor;
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

SELECT t.name AS table_name, c.name AS column_name
FROM sys.tables AS t
INNER JOIN sys.columns AS c ON c.object_id = t.object_id
WHERE t.name IN (N'users', N'profile_views')
  AND c.name IN (N'firebase_uid', N'two_factor_enabled', N'viewed_on')
ORDER BY t.name, c.name;
GO
