-- Curated bilibili AI video courses (tenant 100001 / org 0).
-- Each lesson connects to a public bilibili video via source_provider='bilibili'
-- and external_source_id=<BV id>; the H5 player renders the official iframe.
-- BV ids reference long-running popular AI learning videos; verify and replace
-- by title/uploader before relying on them in production.

-- ── Instructor profiles used by the curated AI courses ───────────────
-- Two of the four uploaders below are also emitted by the generated catalog
-- (010_course_catalog_instructors.sql); the other two are only referenced by
-- these curated courses, so they are defined here.

INSERT INTO course_instructor
    (id, uuid, tenant_id, organization_id, user_id, display_name, title, bio, avatar_resource_snapshot, profile_links_json, expertise_tags_json, qualification_status, sort_order, status, created_at, created_by, updated_at, updated_by, version)
VALUES
    ('instructor-bili-8654113', 'instructor-bili-8654113', '100001', '0', NULL, 'mHarvey', '人工智能 · B 站课程讲师', 'B 站知识区创作者，发布《[双语字幕]吴恩达深度学习deeplearning.ai》等课程。', 'https://i1.hdslb.com/bfs/face/2225e55e8a220865e9bbec7289a0585832d731d6.jpg', '[]', '["人工智能","深度学习","吴恩达"]', 'verified', 900, 'active', CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0),
    ('instructor-bili-3706955994499072', 'instructor-bili-3706955994499072', '100001', '0', NULL, 'Agent全栈开发', '人工智能 · B 站课程讲师', 'B 站知识区创作者，发布《AI 大模型零基础全套教程》等课程。', 'https://i1.hdslb.com/bfs/face/26a037bc24e900f0320cdaf2fefcf2af9cad49b2.jpg', '[]', '["人工智能","大模型","Agent"]', 'verified', 901, 'active', CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0)
ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    title = EXCLUDED.title,
    bio = EXCLUDED.bio,
    avatar_resource_snapshot = EXCLUDED.avatar_resource_snapshot,
    expertise_tags_json = EXCLUDED.expertise_tags_json,
    qualification_status = EXCLUDED.qualification_status,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

-- ── Course 1: 机器学习入门指南 ─────────────────────────────────────────

INSERT INTO course_catalog
    (
        id, uuid, tenant_id, organization_id, course_code, category_id,
        primary_instructor_id,
        title, subtitle, summary, description, difficulty_level, language_code,
        tags_json, cover_resource_snapshot, estimated_duration_seconds,
        lesson_count_snapshot, student_count_snapshot, rating_score_snapshot,
        rating_count_snapshot, external_source_id, visibility, publish_status,
        published_at, status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'course-ai-ml-intro', 'course-ai-ml-intro', '100001', '0', 'AI-ML-101',
        'course-category-ai',
        'instructor-bili-46880349',
        '机器学习入门指南', '从零开始掌握机器学习核心概念',
        '精选 B 站热门机器学习课程:李宏毅、吴恩达等名师经典讲解,覆盖线性模型、神经网络、深度学习入门。',
        '面向零基础学习者的机器学习入门课程。精选 B 站三门经典公开课：李宏毅《机器学习》2021 春、吴恩达《机器学习》系列（中英字幕）与 AI 零基础四大名师合集，共 3 讲、约 4.75 小时，覆盖线性模型、决策树、神经网络与模型评估等核心方法。', 'beginner', 'zh-CN',
        '["机器学习","AI入门","李宏毅","吴恩达"]', 'https://i2.hdslb.com/bfs/archive/f062d5f0a407d0d6d8e3eaf2dd1af32e9099b956.jpg', 17100,
        3, 12800, '4.9',
        2140, 'BV1Wv411h7kN', 'tenant', 'published',
        CURRENT_TIMESTAMP::text, 'active', CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    organization_id = EXCLUDED.organization_id,
    course_code = EXCLUDED.course_code,
    category_id = EXCLUDED.category_id,
    primary_instructor_id = EXCLUDED.primary_instructor_id,
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    difficulty_level = EXCLUDED.difficulty_level,
    tags_json = EXCLUDED.tags_json,
    cover_resource_snapshot = EXCLUDED.cover_resource_snapshot,
    estimated_duration_seconds = EXCLUDED.estimated_duration_seconds,
    lesson_count_snapshot = EXCLUDED.lesson_count_snapshot,
    student_count_snapshot = EXCLUDED.student_count_snapshot,
    rating_score_snapshot = EXCLUDED.rating_score_snapshot,
    visibility = EXCLUDED.visibility,
    publish_status = EXCLUDED.publish_status,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

INSERT INTO course_offering
    (
        id, uuid, tenant_id, organization_id, course_id, offering_code, title,
        offering_type, delivery_mode, access_mode, status,
        created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'offering-ai-ml-intro', 'offering-ai-ml-intro', '100001', '0',
        'course-ai-ml-intro', 'OFR-AI-ML-101', '机器学习入门指南 · 免费公开课',
        'vod', 'self_paced', 'free', 'published',
        CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    organization_id = EXCLUDED.organization_id,
    course_id = EXCLUDED.course_id,
    offering_code = EXCLUDED.offering_code,
    title = EXCLUDED.title,
    offering_type = EXCLUDED.offering_type,
    delivery_mode = EXCLUDED.delivery_mode,
    access_mode = EXCLUDED.access_mode,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

INSERT INTO course_section
    (
        id, uuid, tenant_id, organization_id, course_id, section_no, title,
        description, sort_order, lesson_count_snapshot, duration_seconds_snapshot,
        visibility, status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'section-ai-ml-intro-1', 'section-ai-ml-intro-1', '100001', '0',
        'course-ai-ml-intro', '01', '经典入门', '机器学习经典课程视频', 0, 3, 17100,
        'tenant', 'active', CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    organization_id = EXCLUDED.organization_id,
    course_id = EXCLUDED.course_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    lesson_count_snapshot = EXCLUDED.lesson_count_snapshot,
    duration_seconds_snapshot = EXCLUDED.duration_seconds_snapshot,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

INSERT INTO course_lesson
    (
        id, uuid, tenant_id, organization_id, course_id, section_id, lesson_no,
        lesson_kind, title, description, duration_seconds, duration_text,
        external_source_id, source_provider, free_preview, required_for_completion,
        sort_order, status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'lesson-ai-ml-intro-1', 'lesson-ai-ml-intro-1', '100001', '0',
        'course-ai-ml-intro', 'section-ai-ml-intro-1', '01',
        'vod_video', '李宏毅《机器学习》2021 春 · 完整课程', '台大李宏毅教授最受欢迎的机器学习课程,B 站播放量最高的入门系列之一。', 5400, NULL,
        'BV1Wv411h7kN', 'bilibili', 1, 1,
        0, 'active', CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    organization_id = EXCLUDED.organization_id,
    course_id = EXCLUDED.course_id,
    section_id = EXCLUDED.section_id,
    lesson_kind = EXCLUDED.lesson_kind,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    duration_seconds = EXCLUDED.duration_seconds,
    external_source_id = EXCLUDED.external_source_id,
    source_provider = EXCLUDED.source_provider,
    free_preview = EXCLUDED.free_preview,
    sort_order = EXCLUDED.sort_order,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

INSERT INTO course_lesson
    (
        id, uuid, tenant_id, organization_id, course_id, section_id, lesson_no,
        lesson_kind, title, description, duration_seconds, duration_text,
        external_source_id, source_provider, free_preview, required_for_completion,
        sort_order, status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'lesson-ai-ml-intro-2', 'lesson-ai-ml-intro-2', '100001', '0',
        'course-ai-ml-intro', 'section-ai-ml-intro-1', '02',
        'vod_video', '吴恩达《机器学习》系列 · 中英字幕', '机器学习领域最经典的入门课程,系统讲解监督学习、无监督学习与最佳实践。', 7200, NULL,
        'BV164411b7dx', 'bilibili', 0, 1,
        1, 'active', CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    organization_id = EXCLUDED.organization_id,
    course_id = EXCLUDED.course_id,
    section_id = EXCLUDED.section_id,
    lesson_kind = EXCLUDED.lesson_kind,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    duration_seconds = EXCLUDED.duration_seconds,
    external_source_id = EXCLUDED.external_source_id,
    source_provider = EXCLUDED.source_provider,
    free_preview = EXCLUDED.free_preview,
    sort_order = EXCLUDED.sort_order,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

INSERT INTO course_lesson
    (
        id, uuid, tenant_id, organization_id, course_id, section_id, lesson_no,
        lesson_kind, title, description, duration_seconds, duration_text,
        external_source_id, source_provider, free_preview, required_for_completion,
        sort_order, status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'lesson-ai-ml-intro-3', 'lesson-ai-ml-intro-3', '100001', '0',
        'course-ai-ml-intro', 'section-ai-ml-intro-1', '03',
        'vod_video', 'AI 零基础入门 · 四大名师合集', '整合李宏毅机器学习、吴恩达深度学习、李飞飞计算机视觉与李沐 PyTorch 四位名师的入门讲解。', 4500, NULL,
        'BV1o5ML64Ewa', 'bilibili', 1, 1,
        2, 'active', CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    organization_id = EXCLUDED.organization_id,
    course_id = EXCLUDED.course_id,
    section_id = EXCLUDED.section_id,
    lesson_kind = EXCLUDED.lesson_kind,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    duration_seconds = EXCLUDED.duration_seconds,
    external_source_id = EXCLUDED.external_source_id,
    source_provider = EXCLUDED.source_provider,
    free_preview = EXCLUDED.free_preview,
    sort_order = EXCLUDED.sort_order,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

-- ── Course 2: 深度学习与大模型原理 ─────────────────────────────────────

INSERT INTO course_catalog
    (
        id, uuid, tenant_id, organization_id, course_code, category_id,
        primary_instructor_id,
        title, subtitle, summary, description, difficulty_level, language_code,
        tags_json, cover_resource_snapshot, estimated_duration_seconds,
        lesson_count_snapshot, student_count_snapshot, rating_score_snapshot,
        rating_count_snapshot, external_source_id, visibility, publish_status,
        published_at, status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'course-ai-deep-learning', 'course-ai-deep-learning', '100001', '0', 'AI-DL-201',
        'course-category-ai',
        'instructor-bili-8654113',
        '深度学习与大模型原理', '理解神经网络、Transformer 与大模型训练',
        '吴恩达深度学习双语课程 + 李宏毅 2025 AI 全栈课程,从神经网络到生成式 AI 一网打尽。',
        '面向已有编程基础的学习者。课程包含吴恩达《深度学习》deeplearning.ai 双语字幕完整课程与李宏毅 2025《AI 全栈系统课程》两讲，共约 3.5 小时，理解神经网络核心原理、Transformer 架构与大模型训练对齐过程。', 'intermediate', 'zh-CN',
        '["深度学习","大模型","Transformer","吴恩达"]', 'https://i0.hdslb.com/bfs/archive/debebc8b9326ff6f32f591599ee0f8f59b7fe25a.png', 12600,
        2, 8600, '4.8',
        1520, 'BV1FT4y1E74V', 'tenant', 'published',
        CURRENT_TIMESTAMP::text, 'active', CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    organization_id = EXCLUDED.organization_id,
    course_code = EXCLUDED.course_code,
    category_id = EXCLUDED.category_id,
    primary_instructor_id = EXCLUDED.primary_instructor_id,
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    difficulty_level = EXCLUDED.difficulty_level,
    tags_json = EXCLUDED.tags_json,
    cover_resource_snapshot = EXCLUDED.cover_resource_snapshot,
    estimated_duration_seconds = EXCLUDED.estimated_duration_seconds,
    lesson_count_snapshot = EXCLUDED.lesson_count_snapshot,
    student_count_snapshot = EXCLUDED.student_count_snapshot,
    rating_score_snapshot = EXCLUDED.rating_score_snapshot,
    visibility = EXCLUDED.visibility,
    publish_status = EXCLUDED.publish_status,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

INSERT INTO course_offering
    (
        id, uuid, tenant_id, organization_id, course_id, offering_code, title,
        offering_type, delivery_mode, access_mode, status,
        created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'offering-ai-deep-learning', 'offering-ai-deep-learning', '100001', '0',
        'course-ai-deep-learning', 'OFR-AI-DL-201', '深度学习与大模型原理 · 免费公开课',
        'vod', 'self_paced', 'free', 'published',
        CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    organization_id = EXCLUDED.organization_id,
    course_id = EXCLUDED.course_id,
    offering_code = EXCLUDED.offering_code,
    title = EXCLUDED.title,
    offering_type = EXCLUDED.offering_type,
    delivery_mode = EXCLUDED.delivery_mode,
    access_mode = EXCLUDED.access_mode,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

INSERT INTO course_section
    (
        id, uuid, tenant_id, organization_id, course_id, section_no, title,
        description, sort_order, lesson_count_snapshot, duration_seconds_snapshot,
        visibility, status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'section-ai-deep-learning-1', 'section-ai-deep-learning-1', '100001', '0',
        'course-ai-deep-learning', '01', '核心原理', '深度学习与大模型核心原理', 0, 2, 12600,
        'tenant', 'active', CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    organization_id = EXCLUDED.organization_id,
    course_id = EXCLUDED.course_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    lesson_count_snapshot = EXCLUDED.lesson_count_snapshot,
    duration_seconds_snapshot = EXCLUDED.duration_seconds_snapshot,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

INSERT INTO course_lesson
    (
        id, uuid, tenant_id, organization_id, course_id, section_id, lesson_no,
        lesson_kind, title, description, duration_seconds, duration_text,
        external_source_id, source_provider, free_preview, required_for_completion,
        sort_order, status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'lesson-ai-deep-learning-1', 'lesson-ai-deep-learning-1', '100001', '0',
        'course-ai-deep-learning', 'section-ai-deep-learning-1', '01',
        'vod_video', '吴恩达《深度学习》deeplearning.ai · 双语字幕', '深度学习专项课程,涵盖神经网络、CNN、RNN 与优化算法。', 9000, NULL,
        'BV1FT4y1E74V', 'bilibili', 1, 1,
        0, 'active', CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    organization_id = EXCLUDED.organization_id,
    course_id = EXCLUDED.course_id,
    section_id = EXCLUDED.section_id,
    lesson_kind = EXCLUDED.lesson_kind,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    duration_seconds = EXCLUDED.duration_seconds,
    external_source_id = EXCLUDED.external_source_id,
    source_provider = EXCLUDED.source_provider,
    free_preview = EXCLUDED.free_preview,
    sort_order = EXCLUDED.sort_order,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

INSERT INTO course_lesson
    (
        id, uuid, tenant_id, organization_id, course_id, section_id, lesson_no,
        lesson_kind, title, description, duration_seconds, duration_text,
        external_source_id, source_provider, free_preview, required_for_completion,
        sort_order, status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'lesson-ai-deep-learning-2', 'lesson-ai-deep-learning-2', '100001', '0',
        'course-ai-deep-learning', 'section-ai-deep-learning-1', '02',
        'vod_video', '李宏毅 2025《AI 全栈系统课程》', '生成式 AI、AI Agent、Transformer 与 LLM 预训练-对齐的完整体系讲解。', 3600, NULL,
        'BV1hMRUYPEbJ', 'bilibili', 0, 1,
        1, 'active', CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    organization_id = EXCLUDED.organization_id,
    course_id = EXCLUDED.course_id,
    section_id = EXCLUDED.section_id,
    lesson_kind = EXCLUDED.lesson_kind,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    duration_seconds = EXCLUDED.duration_seconds,
    external_source_id = EXCLUDED.external_source_id,
    source_provider = EXCLUDED.source_provider,
    free_preview = EXCLUDED.free_preview,
    sort_order = EXCLUDED.sort_order,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

-- ── Course 3: 提示词工程实战 ─────────────────────────────────────────

INSERT INTO course_catalog
    (
        id, uuid, tenant_id, organization_id, course_code, category_id,
        primary_instructor_id,
        title, subtitle, summary, description, difficulty_level, language_code,
        tags_json, cover_resource_snapshot, estimated_duration_seconds,
        lesson_count_snapshot, student_count_snapshot, rating_score_snapshot,
        rating_count_snapshot, external_source_id, visibility, publish_status,
        published_at, status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'course-ai-prompt-engineering', 'course-ai-prompt-engineering', '100001', '0', 'AI-PROMPT-301',
        'course-category-ai',
        'instructor-bili-431850986',
        '提示词工程实战', '写出高质量 Prompt,用好大模型',
        '吴恩达与 OpenAI 官方提示词工程课程中文版 + AI 办公实战应用。',
        '面向内容创作者与开发者的提示词工程实战课程。包含吴恩达《ChatGPT Prompt Engineering》中文版与《AI 办公实战：从提示词、写作到数据分析》两讲，共约 1.06 小时，覆盖角色设定、少样本、思维链等技巧，并落地写作与数据分析场景。', 'beginner', 'zh-CN',
        '["提示词","Prompt","ChatGPT","AIGC"]', 'https://i2.hdslb.com/bfs/archive/828a7eb16d0ce66508ae3859462bae98c0faca52.jpg', 3819,
        2, 15600, '4.9',
        2680, 'BV1Bo4y1A7FU', 'tenant', 'published',
        CURRENT_TIMESTAMP::text, 'active', CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    organization_id = EXCLUDED.organization_id,
    course_code = EXCLUDED.course_code,
    category_id = EXCLUDED.category_id,
    primary_instructor_id = EXCLUDED.primary_instructor_id,
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    difficulty_level = EXCLUDED.difficulty_level,
    tags_json = EXCLUDED.tags_json,
    cover_resource_snapshot = EXCLUDED.cover_resource_snapshot,
    estimated_duration_seconds = EXCLUDED.estimated_duration_seconds,
    lesson_count_snapshot = EXCLUDED.lesson_count_snapshot,
    student_count_snapshot = EXCLUDED.student_count_snapshot,
    rating_score_snapshot = EXCLUDED.rating_score_snapshot,
    visibility = EXCLUDED.visibility,
    publish_status = EXCLUDED.publish_status,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

INSERT INTO course_offering
    (
        id, uuid, tenant_id, organization_id, course_id, offering_code, title,
        offering_type, delivery_mode, access_mode, status,
        created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'offering-ai-prompt-engineering', 'offering-ai-prompt-engineering', '100001', '0',
        'course-ai-prompt-engineering', 'OFR-AI-PROMPT-301', '提示词工程实战 · 免费公开课',
        'vod', 'self_paced', 'free', 'published',
        CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    organization_id = EXCLUDED.organization_id,
    course_id = EXCLUDED.course_id,
    offering_code = EXCLUDED.offering_code,
    title = EXCLUDED.title,
    offering_type = EXCLUDED.offering_type,
    delivery_mode = EXCLUDED.delivery_mode,
    access_mode = EXCLUDED.access_mode,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

INSERT INTO course_section
    (
        id, uuid, tenant_id, organization_id, course_id, section_no, title,
        description, sort_order, lesson_count_snapshot, duration_seconds_snapshot,
        visibility, status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'section-ai-prompt-engineering-1', 'section-ai-prompt-engineering-1', '100001', '0',
        'course-ai-prompt-engineering', '01', '提示词核心', '提示词工程核心方法', 0, 2, 3819,
        'tenant', 'active', CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    organization_id = EXCLUDED.organization_id,
    course_id = EXCLUDED.course_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    lesson_count_snapshot = EXCLUDED.lesson_count_snapshot,
    duration_seconds_snapshot = EXCLUDED.duration_seconds_snapshot,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

INSERT INTO course_lesson
    (
        id, uuid, tenant_id, organization_id, course_id, section_id, lesson_no,
        lesson_kind, title, description, duration_seconds, duration_text,
        external_source_id, source_provider, free_preview, required_for_completion,
        sort_order, status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'lesson-ai-prompt-engineering-1', 'lesson-ai-prompt-engineering-1', '100001', '0',
        'course-ai-prompt-engineering', 'section-ai-prompt-engineering-1', '01',
        'vod_video', '吴恩达《ChatGPT Prompt Engineering》中文版', '吴恩达与 OpenAI 官方合作课程,系统讲解提示词工程核心原则与实践。', 3000, NULL,
        'BV1Bo4y1A7FU', 'bilibili', 1, 1,
        0, 'active', CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    organization_id = EXCLUDED.organization_id,
    course_id = EXCLUDED.course_id,
    section_id = EXCLUDED.section_id,
    lesson_kind = EXCLUDED.lesson_kind,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    duration_seconds = EXCLUDED.duration_seconds,
    external_source_id = EXCLUDED.external_source_id,
    source_provider = EXCLUDED.source_provider,
    free_preview = EXCLUDED.free_preview,
    sort_order = EXCLUDED.sort_order,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

INSERT INTO course_lesson
    (
        id, uuid, tenant_id, organization_id, course_id, section_id, lesson_no,
        lesson_kind, title, description, duration_seconds, duration_text,
        external_source_id, source_provider, free_preview, required_for_completion,
        sort_order, status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'lesson-ai-prompt-engineering-2', 'lesson-ai-prompt-engineering-2', '100001', '0',
        'course-ai-prompt-engineering', 'section-ai-prompt-engineering-1', '02',
        'vod_video', 'AI 办公实战：从提示词、写作到数据分析', '用提示词驱动写作、数据整理与 AI 绘画,把大模型真正用进日常工作。', 819, NULL,
        'BV1Vd8i6iEjd', 'bilibili', 1, 1,
        1, 'active', CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    organization_id = EXCLUDED.organization_id,
    course_id = EXCLUDED.course_id,
    section_id = EXCLUDED.section_id,
    lesson_kind = EXCLUDED.lesson_kind,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    duration_seconds = EXCLUDED.duration_seconds,
    external_source_id = EXCLUDED.external_source_id,
    source_provider = EXCLUDED.source_provider,
    free_preview = EXCLUDED.free_preview,
    sort_order = EXCLUDED.sort_order,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

-- ── Course 4: AI 应用与智能体开发 ────────────────────────────────────

INSERT INTO course_catalog
    (
        id, uuid, tenant_id, organization_id, course_code, category_id,
        primary_instructor_id,
        title, subtitle, summary, description, difficulty_level, language_code,
        tags_json, cover_resource_snapshot, estimated_duration_seconds,
        lesson_count_snapshot, student_count_snapshot, rating_score_snapshot,
        rating_count_snapshot, external_source_id, visibility, publish_status,
        published_at, status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'course-ai-agent-development', 'course-ai-agent-development', '100001', '0', 'AI-AGENT-401',
        'course-category-ai',
        'instructor-bili-3706955994499072',
        'AI 应用与智能体开发', '从大模型应用到 Agent 工程实践',
        '大模型零基础全套教程 + AI Agent 开发实战,覆盖 RAG、LangChain、向量数据库与多智能体协作。',
        '面向开发者的 AI 应用实战课程。包含《AI 大模型零基础全套教程》与《AI Agent 开发零基础教程》两讲，共约 3.5 小时，从大模型应用开发基础出发，深入 RAG 检索增强、Agent 框架与多智能体协作工程实践。', 'advanced', 'zh-CN',
        '["Agent","RAG","LangChain","大模型应用"]', 'https://i2.hdslb.com/bfs/archive/b407a36eb05d9e0142d48fe017779edf09635584.jpg', 12600,
        2, 7200, '4.7',
        980, 'BV18U596gEZ7', 'tenant', 'published',
        CURRENT_TIMESTAMP::text, 'active', CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    organization_id = EXCLUDED.organization_id,
    course_code = EXCLUDED.course_code,
    category_id = EXCLUDED.category_id,
    primary_instructor_id = EXCLUDED.primary_instructor_id,
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    difficulty_level = EXCLUDED.difficulty_level,
    tags_json = EXCLUDED.tags_json,
    cover_resource_snapshot = EXCLUDED.cover_resource_snapshot,
    estimated_duration_seconds = EXCLUDED.estimated_duration_seconds,
    lesson_count_snapshot = EXCLUDED.lesson_count_snapshot,
    student_count_snapshot = EXCLUDED.student_count_snapshot,
    rating_score_snapshot = EXCLUDED.rating_score_snapshot,
    visibility = EXCLUDED.visibility,
    publish_status = EXCLUDED.publish_status,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

INSERT INTO course_offering
    (
        id, uuid, tenant_id, organization_id, course_id, offering_code, title,
        offering_type, delivery_mode, access_mode, status,
        created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'offering-ai-agent-development', 'offering-ai-agent-development', '100001', '0',
        'course-ai-agent-development', 'OFR-AI-AGENT-401', 'AI 应用与智能体开发 · 免费公开课',
        'vod', 'self_paced', 'free', 'published',
        CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    organization_id = EXCLUDED.organization_id,
    course_id = EXCLUDED.course_id,
    offering_code = EXCLUDED.offering_code,
    title = EXCLUDED.title,
    offering_type = EXCLUDED.offering_type,
    delivery_mode = EXCLUDED.delivery_mode,
    access_mode = EXCLUDED.access_mode,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

INSERT INTO course_section
    (
        id, uuid, tenant_id, organization_id, course_id, section_no, title,
        description, sort_order, lesson_count_snapshot, duration_seconds_snapshot,
        visibility, status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'section-ai-agent-development-1', 'section-ai-agent-development-1', '100001', '0',
        'course-ai-agent-development', '01', 'Agent 与工程实践', '大模型应用与智能体开发实战', 0, 2, 12600,
        'tenant', 'active', CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    organization_id = EXCLUDED.organization_id,
    course_id = EXCLUDED.course_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    lesson_count_snapshot = EXCLUDED.lesson_count_snapshot,
    duration_seconds_snapshot = EXCLUDED.duration_seconds_snapshot,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

INSERT INTO course_lesson
    (
        id, uuid, tenant_id, organization_id, course_id, section_id, lesson_no,
        lesson_kind, title, description, duration_seconds, duration_text,
        external_source_id, source_provider, free_preview, required_for_completion,
        sort_order, status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'lesson-ai-agent-development-1', 'lesson-ai-agent-development-1', '100001', '0',
        'course-ai-agent-development', 'section-ai-agent-development-1', '01',
        'vod_video', 'AI 大模型零基础全套教程', '从零开始的大模型应用教程:提示词工程、RAG、Agent 与私有化部署。', 7200, NULL,
        'BV18U596gEZ7', 'bilibili', 1, 1,
        0, 'active', CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    organization_id = EXCLUDED.organization_id,
    course_id = EXCLUDED.course_id,
    section_id = EXCLUDED.section_id,
    lesson_kind = EXCLUDED.lesson_kind,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    duration_seconds = EXCLUDED.duration_seconds,
    external_source_id = EXCLUDED.external_source_id,
    source_provider = EXCLUDED.source_provider,
    free_preview = EXCLUDED.free_preview,
    sort_order = EXCLUDED.sort_order,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

INSERT INTO course_lesson
    (
        id, uuid, tenant_id, organization_id, course_id, section_id, lesson_no,
        lesson_kind, title, description, duration_seconds, duration_text,
        external_source_id, source_provider, free_preview, required_for_completion,
        sort_order, status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'lesson-ai-agent-development-2', 'lesson-ai-agent-development-2', '100001', '0',
        'course-ai-agent-development', 'section-ai-agent-development-1', '02',
        'vod_video', 'AI Agent 开发零基础教程', 'LangChain 入门、Prompt 模板、RAG 与向量数据库,实战构建智能文档助手。', 5400, NULL,
        'BV1R1Gw6YErj', 'bilibili', 0, 1,
        1, 'active', CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0
    )
ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    organization_id = EXCLUDED.organization_id,
    course_id = EXCLUDED.course_id,
    section_id = EXCLUDED.section_id,
    lesson_kind = EXCLUDED.lesson_kind,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    duration_seconds = EXCLUDED.duration_seconds,
    external_source_id = EXCLUDED.external_source_id,
    source_provider = EXCLUDED.source_provider,
    free_preview = EXCLUDED.free_preview,
    sort_order = EXCLUDED.sort_order,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;
