
-- Immediate timeout/lock fix script
-- Run this script when experiencing timeouts or database locks

-- 1. Check for long-running queries that might be causing issues
SELECT 
    pid,
    now() - query_start AS duration,
    usename AS username,
    query
FROM 
    pg_stat_activity
WHERE 
    state != 'idle' AND
    query_start < (now() - interval '10 seconds') AND
    query NOT LIKE '%pg_stat_activity%'
ORDER BY 
    duration DESC
LIMIT 10;

-- 2. Cancel any long-running queries (safer than terminating)
DO $$
DECLARE
    timeout_threshold INTERVAL := interval '30 seconds';
    r RECORD;
BEGIN
    FOR r IN 
        SELECT 
            pid, 
            query,
            now() - query_start AS duration
        FROM 
            pg_stat_activity
        WHERE
            state = 'active' AND
            query_start < (now() - timeout_threshold) AND
            query NOT LIKE '%pg_stat_activity%' AND
            query NOT LIKE '%pg_locks%'
    LOOP
        RAISE NOTICE 'Cancelling query: % (duration: %)', left(r.query, 50), r.duration;
        PERFORM pg_cancel_backend(r.pid);
    END LOOP;
END$$;

-- 3. Terminate any idle-in-transaction queries that might be holding locks
DO $$
DECLARE
    idle_timeout INTERVAL := interval '1 minute';
    r RECORD;
BEGIN
    FOR r IN 
        SELECT 
            pid, 
            query,
            now() - query_start AS duration
        FROM 
            pg_stat_activity
        WHERE
            state = 'idle in transaction' AND
            query_start < (now() - idle_timeout)
    LOOP
        RAISE NOTICE 'Terminating idle transaction: % (duration: %)', left(r.query, 50), r.duration;
        PERFORM pg_terminate_backend(r.pid);
    END LOOP;
END$$;

-- 4. Check for locks that might be blocking operations
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocking_locks.pid AS blocking_pid,
    blocked_activity.usename AS blocked_user,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS blocking_statement
FROM 
    pg_catalog.pg_locks blocked_locks
JOIN 
    pg_catalog.pg_locks blocking_locks 
    ON blocked_locks.locktype = blocking_locks.locktype
    AND blocked_locks.DATABASE IS NOT DISTINCT FROM blocking_locks.DATABASE
    AND blocked_locks.relation IS NOT DISTINCT FROM blocking_locks.relation
    AND blocked_locks.page IS NOT DISTINCT FROM blocking_locks.page
    AND blocked_locks.tuple IS NOT DISTINCT FROM blocking_locks.tuple
    AND blocked_locks.virtualxid IS NOT DISTINCT FROM blocking_locks.virtualxid
    AND blocked_locks.transactionid IS NOT DISTINCT FROM blocking_locks.transactionid
    AND blocked_locks.classid IS NOT DISTINCT FROM blocking_locks.classid
    AND blocked_locks.objid IS NOT DISTINCT FROM blocking_locks.objid
    AND blocked_locks.objsubid IS NOT DISTINCT FROM blocking_locks.objsubid
    AND blocked_locks.pid != blocking_locks.pid
JOIN 
    pg_catalog.pg_stat_activity blocked_activity 
    ON blocked_activity.pid = blocked_locks.pid
JOIN 
    pg_catalog.pg_stat_activity blocking_activity 
    ON blocking_activity.pid = blocking_locks.pid
WHERE 
    NOT blocked_locks.GRANTED;

-- 5. Call our xdelo_kill_long_queries function to automatically handle problematic queries
SELECT * FROM xdelo_kill_long_queries(15); -- Kill queries running longer than 15 seconds

-- 6. Update statistics to help the query planner make better decisions
ANALYZE messages;

-- 7. Check the status of our critical indexes
SELECT
    indexname,
    indexdef
FROM
    pg_indexes
WHERE
    tablename = 'messages' AND
    (indexname LIKE 'idx_messages%' OR indexname LIKE 'messages_pkey');

-- 8. Schedule a background job to run our data migration procedure
DO $$
BEGIN
    RAISE NOTICE 'Starting background migration of telegram_data to telegram_metadata';
    CALL xdelo_migrate_telegram_data(500);
END$$; 
