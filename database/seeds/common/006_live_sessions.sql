INSERT INTO course_live_session
    (
        id, uuid, tenant_id, organization_id, course_id, offering_id, lesson_id,
        instructor_id, title, description, live_provider_code, provider_room_ref,
        scheduled_start_at, scheduled_end_at, actual_start_at, actual_end_at,
        live_status, replay_resource_ref_id, replay_available_at,
        attendee_count_snapshot, heartbeat_rule_json, metadata_json,
        status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'live-ai-agent-open-class', 'live-ai-agent-open-class', '100001', '0',
        'course-ai-agent-development', 'offering-ai-agent-development', NULL,
        'platform-instructor',
        'AI Agent 公开课：从提示词到可执行工作流',
        '从真实业务问题出发，现场拆解 Agent 的任务规划、工具调用与评测方法。',
        'sdkwork_live', 'https://live.bilibili.com/6',
        '2026-10-21T14:00:00Z', '2026-10-21T15:30:00Z',
        '2026-10-21T14:00:00Z', NULL,
        'live', NULL, NULL, 1280,
        '{"intervalSeconds":30,"graceSeconds":120}',
        '{"coverUrl":"https://i2.hdslb.com/bfs/archive/b407a36eb05d9e0142d48fe017779edf09635584.jpg","instructorName":"平台讲师","entryLabel":"进入直播间"}',
        'active', '2026-10-21T14:15:00Z', 'seed', '2026-10-21T14:15:00Z', 'seed', 0
    ),
    (
        'live-ai-productivity-workshop', 'live-ai-productivity-workshop', '100001', '0',
        'course-column-ai-productivity', 'offering-column-ai-productivity', NULL,
        'platform-instructor',
        'AI 效率工作坊：把重复工作交给工作流',
        '带着一个真实重复任务来，现场完成信息采集、整理与自动分发的闭环。',
        'sdkwork_live', 'https://live.bilibili.com/6',
        '2026-10-22T06:00:00Z', '2026-10-22T07:30:00Z',
        NULL, NULL, 'scheduled', NULL, NULL, 0,
        '{"intervalSeconds":30,"graceSeconds":120}',
        '{"coverUrl":"https://i1.hdslb.com/bfs/archive/e101c4c44c062ef36134a141dfeb0e517489f5e2.jpg","instructorName":"林知远","entryLabel":"预约直播"}',
        'active', '2026-10-21T14:15:00Z', 'seed', '2026-10-21T14:15:00Z', 'seed', 0
    ),
    (
        'live-ai-engineer-career', 'live-ai-engineer-career', '100001', '0',
        'course-collection-ai-engineer', 'offering-collection-ai-engineer', NULL,
        'platform-instructor',
        'AI 工程师职业路径答疑：作品集与面试准备',
        '围绕 AI 应用工程师的能力栈、项目作品集和面试问题做一次完整答疑。',
        'sdkwork_live', 'https://live.bilibili.com/6',
        '2026-10-19T13:00:00Z', '2026-10-19T14:30:00Z',
        '2026-10-19T13:00:00Z', '2026-10-19T14:30:00Z',
        'ended', 'replay-ai-engineer-career', '2026-10-19T15:30:00Z',
        6420,
        '{"intervalSeconds":30,"graceSeconds":120}',
        '{"coverUrl":"https://i2.hdslb.com/bfs/archive/f062d5f0a407d0d6d8e3eaf2dd1af32e9099b956.jpg","instructorName":"平台讲师","replayLabel":"观看回放"}',
        'active', '2026-10-21T14:15:00Z', 'seed', '2026-10-21T14:15:00Z', 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    course_id = EXCLUDED.course_id,
    offering_id = EXCLUDED.offering_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    scheduled_start_at = EXCLUDED.scheduled_start_at,
    scheduled_end_at = EXCLUDED.scheduled_end_at,
    actual_start_at = EXCLUDED.actual_start_at,
    actual_end_at = EXCLUDED.actual_end_at,
    live_status = EXCLUDED.live_status,
    replay_resource_ref_id = EXCLUDED.replay_resource_ref_id,
    replay_available_at = EXCLUDED.replay_available_at,
    attendee_count_snapshot = EXCLUDED.attendee_count_snapshot,
    metadata_json = EXCLUDED.metadata_json,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;
