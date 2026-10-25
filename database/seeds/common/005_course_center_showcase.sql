-- Course center showcase: a paid 专栏 (column), an official 合集
-- (collection), and one UGC course waiting in the operator review queue.
-- Tenant 100001 / org 0. Idempotent by primary key / unique membership.

-- ── Author profiles for author-written showcase content ──────────────
-- Columns and UGC courses are written by platform authors, not Bilibili
-- uploaders, so their instructor profile mirrors the author identity.

INSERT INTO course_instructor
    (id, uuid, tenant_id, organization_id, user_id, display_name, title, bio, avatar_resource_snapshot, profile_links_json, expertise_tags_json, qualification_status, sort_order, status, created_at, created_by, updated_at, updated_by, version)
VALUES
    ('instructor-author-demo-creator-1', 'instructor-author-demo-creator-1', '100001', '0', NULL, '林知远', 'AI 效率 · 专栏作者', '在课程中心更新 AI 效率工作法专栏，分享可复用的提示词与自动化工作流。', NULL, '[]', '["AI效率","提示词","工作流"]', 'verified', 902, 'active', CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0),
    ('instructor-author-demo-creator-2', 'instructor-author-demo-creator-2', '100001', '0', NULL, '苏晚', 'AI 写作 · 训练营作者', '在课程中心开设 AI 写作训练营，帮助写作新手建立稳定的成稿流程。', NULL, '[]', '["AI写作","训练营","UGC"]', 'verified', 903, 'active', CURRENT_TIMESTAMP::text, 'seed', CURRENT_TIMESTAMP::text, 'seed', 0)
ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    title = EXCLUDED.title,
    bio = EXCLUDED.bio,
    avatar_resource_snapshot = EXCLUDED.avatar_resource_snapshot,
    expertise_tags_json = EXCLUDED.expertise_tags_json,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

-- ── 专栏：AI 效率工作法 ─────────────────────────────────────────────

INSERT INTO course_catalog
    (
        id, uuid, tenant_id, organization_id, course_code, category_id,
        primary_instructor_id,
        title, subtitle, summary, description, difficulty_level, language_code,
        tags_json, cover_resource_snapshot, estimated_duration_seconds,
        lesson_count_snapshot, student_count_snapshot, rating_score_snapshot,
        rating_count_snapshot, price_amount, original_price_amount, currency,
        is_free, is_collection, course_kind, author_user_id, author_display_name,
        review_round, visibility, publish_status, published_at, reviewed_at,
        reviewed_by, status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'course-column-ai-productivity',
        'course-column-ai-productivity',
        '100001',
        '0',
        'COL-AI-001',
        'course-category-ai',
        'instructor-author-demo-creator-1',
        'AI 效率工作法',
        '用 AI 重构你的日常工作流',
        '3 篇实战专栏，从信息整理、写作、会议到自动化，把 AI 变成每天都能用上的生产力工具。',
        '这是一档面向知识工作者的 AI 实战专栏，共 3 篇正文、约 1.77 小时。每篇都给出可直接复用的提示词、工作流模板和工具组合，依次覆盖信息整理、内容输出与流程自动化，帮助你把 AI 变成每天都能用上的生产力工具。',
        'intermediate',
        'zh-CN',
        '["AI效率","提示词","工作流","职场进阶"]',
        'https://i1.hdslb.com/bfs/archive/cd98b440aed21c91b7f996aa3afb3d818dfaf919.jpg',
        6360,
        3,
        2860,
        '4.9',
        412,
        '129.00',
        '199.00',
        'CNY',
        0,
        0,
        'column',
        'demo-creator-1',
        '林知远',
        1,
        'tenant',
        'published',
        CURRENT_TIMESTAMP::text,
        CURRENT_TIMESTAMP::text,
        'seed',
        'active',
        CURRENT_TIMESTAMP::text,
        'seed',
        CURRENT_TIMESTAMP::text,
        'seed',
        0
    )
ON CONFLICT (id) DO UPDATE SET
    primary_instructor_id = EXCLUDED.primary_instructor_id,
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    estimated_duration_seconds = EXCLUDED.estimated_duration_seconds,
    lesson_count_snapshot = EXCLUDED.lesson_count_snapshot,
    cover_resource_snapshot = EXCLUDED.cover_resource_snapshot,
    price_amount = EXCLUDED.price_amount,
    original_price_amount = EXCLUDED.original_price_amount,
    currency = EXCLUDED.currency,
    is_free = EXCLUDED.is_free,
    is_collection = EXCLUDED.is_collection,
    course_kind = EXCLUDED.course_kind,
    author_user_id = EXCLUDED.author_user_id,
    author_display_name = EXCLUDED.author_display_name,
    publish_status = EXCLUDED.publish_status,
    published_at = EXCLUDED.published_at,
    updated_at = EXCLUDED.updated_at;

INSERT INTO course_offering
    (
        id, uuid, tenant_id, organization_id, course_id, offering_code, title,
        offering_type, delivery_mode, access_mode, access_policy_json,
        completion_rule_json, certificate_enabled, status, created_at, created_by,
        updated_at, updated_by, version
    )
VALUES
    (
        'offering-column-ai-productivity',
        'offering-column-ai-productivity',
        '100001',
        '0',
        'course-column-ai-productivity',
        'COL-AI-001-default',
        'AI 效率工作法',
        'vod',
        'self_paced',
        'paid',
        '{"priceAmount":"129.00","currency":"CNY","commerceSkuId":"1620"}',
        '{}',
        0,
        'published',
        CURRENT_TIMESTAMP::text,
        'seed',
        CURRENT_TIMESTAMP::text,
        'seed',
        0
    )
ON CONFLICT (id) DO UPDATE SET
    access_mode = EXCLUDED.access_mode,
    access_policy_json = EXCLUDED.access_policy_json,
    status = EXCLUDED.status;

INSERT INTO course_section
    (
        id, uuid, tenant_id, organization_id, course_id, section_no, title,
        description, sort_order, lesson_count_snapshot, duration_seconds_snapshot,
        visibility, status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'section-column-ai-productivity-01',
        'section-column-ai-productivity-01',
        '100001',
        '0',
        'course-column-ai-productivity',
        'S0001',
        '第一章 · 信息输入',
        '把杂乱的信息流变成可检索的第二大脑',
        0,
        1,
        1800,
        'tenant',
        'active',
        CURRENT_TIMESTAMP::text,
        'seed',
        CURRENT_TIMESTAMP::text,
        'seed',
        0
    ),
    (
        'section-column-ai-productivity-02',
        'section-column-ai-productivity-02',
        '100001',
        '0',
        'course-column-ai-productivity',
        'S0002',
        '第二章 · 内容输出',
        '从提纲到成稿的 AI 协作写作',
        1,
        1,
        2160,
        'tenant',
        'active',
        CURRENT_TIMESTAMP::text,
        'seed',
        CURRENT_TIMESTAMP::text,
        'seed',
        0
    ),
    (
        'section-column-ai-productivity-03',
        'section-column-ai-productivity-03',
        '100001',
        '0',
        'course-column-ai-productivity',
        'S0003',
        '第三章 · 自动化',
        '让重复工作自动跑起来',
        2,
        1,
        2400,
        'tenant',
        'active',
        CURRENT_TIMESTAMP::text,
        'seed',
        CURRENT_TIMESTAMP::text,
        'seed',
        0
    )
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    lesson_count_snapshot = EXCLUDED.lesson_count_snapshot,
    duration_seconds_snapshot = EXCLUDED.duration_seconds_snapshot;

INSERT INTO course_lesson
    (
        id, uuid, tenant_id, organization_id, course_id, section_id, lesson_no,
        lesson_kind, title, description, content, duration_seconds, duration_text,
        free_preview, required_for_completion, completion_rule_json, sort_order,
        status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'lesson-column-ai-input',
        'lesson-column-ai-input',
        '100001',
        '0',
        'course-column-ai-productivity',
        'section-column-ai-productivity-01',
        'L0001',
        'article',
        '01｜建立你的 AI 信息漏斗',
        '用一个入口、三个过滤器，替代七个收藏夹。',
        '大多数人把 AI 当成搜索框，于是信息越存越乱。本篇给出「入口—过滤器—沉淀」三步法：固定一个采集入口，用摘要、归类、可执行性三个过滤器筛掉噪音，最后把真正有价值的内容写进可检索的知识卡片。文末附带一套可直接复制的提示词模板。',
        1800,
        '30 分钟',
        1,
        1,
        '{}',
        1,
        'active',
        CURRENT_TIMESTAMP::text,
        'seed',
        CURRENT_TIMESTAMP::text,
        'seed',
        0
    ),
    (
        'lesson-column-ai-writing',
        'lesson-column-ai-writing',
        '100001',
        '0',
        'course-column-ai-productivity',
        'section-column-ai-productivity-02',
        'L0002',
        'article',
        '02｜AI 协作写作的四段式',
        '先定判断，再搭结构，最后让 AI 补细节。',
        'AI 写作最常见的问题是「正确但空」。本篇把写作拆成判断、结构、论据、语言四段：人负责前两段，AI 负责后两段，并给出每一步的验收标准。你会得到一套稳定的成稿流程，而不是一次次碰运气的提示词。',
        2160,
        '36 分钟',
        0,
        1,
        '{}',
        1,
        'active',
        CURRENT_TIMESTAMP::text,
        'seed',
        CURRENT_TIMESTAMP::text,
        'seed',
        0
    ),
    (
        'lesson-column-ai-automation',
        'lesson-column-ai-automation',
        '100001',
        '0',
        'course-column-ai-productivity',
        'section-column-ai-productivity-03',
        'L0003',
        'article',
        '03｜把重复任务交给工作流',
        '从日报、周报到客户跟进，一次搭好长期复用。',
        '本篇用三个真实场景演示如何把重复任务拆成触发、采集、生成、校对、归档五步，并选择适合的工具组合。重点不是工具本身，而是让流程在你不盯着的时候也能稳定产出。',
        2400,
        '40 分钟',
        0,
        1,
        '{}',
        1,
        'active',
        CURRENT_TIMESTAMP::text,
        'seed',
        CURRENT_TIMESTAMP::text,
        'seed',
        0
    )
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    content = EXCLUDED.content,
    section_id = EXCLUDED.section_id,
    sort_order = EXCLUDED.sort_order;

-- ── 合集：AI 工程师成长路径 ────────────────────────────────────────

INSERT INTO course_catalog
    (
        id, uuid, tenant_id, organization_id, course_code, category_id,
        primary_instructor_id,
        title, subtitle, summary, description, difficulty_level, language_code,
        tags_json, cover_resource_snapshot, estimated_duration_seconds,
        lesson_count_snapshot, student_count_snapshot, rating_score_snapshot,
        rating_count_snapshot, price_amount, currency, is_free, is_collection,
        course_kind, review_round, visibility, publish_status, published_at,
        reviewed_at, reviewed_by, status, created_at, created_by, updated_at,
        updated_by, version
    )
VALUES
    (
        'course-collection-ai-engineer',
        'course-collection-ai-engineer',
        '100001',
        '0',
        'SET-AI-001',
        'course-category-ai',
        'instructor-bili-46880349',
        'AI 工程师成长路径',
        '三门课，走完从入门到应用的全链路',
        '官方精选三门 AI 课程，按「基础认知 → 深度学习 → 提示词应用」顺序学习，适合想系统转型 AI 应用开发的工程师。',
        '合集由课程中心官方维护，包含机器学习入门指南、深度学习与大模型原理、提示词工程实战三门课程，共 7 讲、约 9.3 小时。购买合集后可按照「基础认知 → 深度学习 → 提示词应用」的推荐顺序学习，也可单独进入任意一门课程。',
        'beginner',
        'zh-CN',
        '["AI工程师","学习路径","合集"]',
        'https://i1.hdslb.com/bfs/archive/2606dbfe0f821748fb8e1018f177453183c3114b.png',
        33519,
        7,
        6420,
        '4.8',
        936,
        '0',
        'CNY',
        1,
        1,
        'collection',
        1,
        'tenant',
        'published',
        CURRENT_TIMESTAMP::text,
        CURRENT_TIMESTAMP::text,
        'seed',
        'active',
        CURRENT_TIMESTAMP::text,
        'seed',
        CURRENT_TIMESTAMP::text,
        'seed',
        0
    )
ON CONFLICT (id) DO UPDATE SET
    primary_instructor_id = EXCLUDED.primary_instructor_id,
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    estimated_duration_seconds = EXCLUDED.estimated_duration_seconds,
    lesson_count_snapshot = EXCLUDED.lesson_count_snapshot,
    cover_resource_snapshot = EXCLUDED.cover_resource_snapshot,
    is_free = EXCLUDED.is_free,
    is_collection = EXCLUDED.is_collection,
    course_kind = EXCLUDED.course_kind,
    publish_status = EXCLUDED.publish_status,
    published_at = EXCLUDED.published_at,
    updated_at = EXCLUDED.updated_at;

INSERT INTO course_offering
    (
        id, uuid, tenant_id, organization_id, course_id, offering_code, title,
        offering_type, delivery_mode, access_mode, access_policy_json,
        completion_rule_json, certificate_enabled, status, created_at, created_by,
        updated_at, updated_by, version
    )
VALUES
    (
        'offering-collection-ai-engineer',
        'offering-collection-ai-engineer',
        '100001',
        '0',
        'course-collection-ai-engineer',
        'SET-AI-001-default',
        'AI 工程师成长路径',
        'blended',
        'self_paced',
        'free',
        '{}',
        '{}',
        0,
        'published',
        CURRENT_TIMESTAMP::text,
        'seed',
        CURRENT_TIMESTAMP::text,
        'seed',
        0
    )
ON CONFLICT (id) DO UPDATE SET
    access_mode = EXCLUDED.access_mode,
    status = EXCLUDED.status;

INSERT INTO course_catalog_link
    (
        id, uuid, tenant_id, organization_id, course_id, linked_course_id,
        link_type, sort_order, status, created_at, updated_at
    )
VALUES
    (
        'link-collection-ai-engineer-01',
        'link-collection-ai-engineer-01',
        '100001',
        '0',
        'course-collection-ai-engineer',
        'course-ai-ml-intro',
        'collection_item',
        0,
        'active',
        CURRENT_TIMESTAMP::text,
        CURRENT_TIMESTAMP::text
    ),
    (
        'link-collection-ai-engineer-02',
        'link-collection-ai-engineer-02',
        '100001',
        '0',
        'course-collection-ai-engineer',
        'course-ai-deep-learning',
        'collection_item',
        1,
        'active',
        CURRENT_TIMESTAMP::text,
        CURRENT_TIMESTAMP::text
    ),
    (
        'link-collection-ai-engineer-03',
        'link-collection-ai-engineer-03',
        '100001',
        '0',
        'course-collection-ai-engineer',
        'course-ai-prompt-engineering',
        'collection_item',
        2,
        'active',
        CURRENT_TIMESTAMP::text,
        CURRENT_TIMESTAMP::text
    )
ON CONFLICT (tenant_id, course_id, linked_course_id, link_type) DO UPDATE SET
    sort_order = EXCLUDED.sort_order,
    status = EXCLUDED.status;

-- ── UGC：待审核课程 ────────────────────────────────────────────────

INSERT INTO course_catalog
    (
        id, uuid, tenant_id, organization_id, course_code, category_id,
        primary_instructor_id,
        title, subtitle, summary, description, difficulty_level, language_code,
        tags_json, cover_resource_snapshot, estimated_duration_seconds,
        lesson_count_snapshot, student_count_snapshot, rating_score_snapshot,
        rating_count_snapshot, price_amount, currency, is_free, is_collection,
        course_kind, author_user_id, author_display_name, submitted_at,
        review_round, visibility, publish_status, status, created_at, created_by,
        updated_at, updated_by, version
    )
VALUES
    (
        'course-ugc-pending-ai-writing',
        'course-ugc-pending-ai-writing',
        '100001',
        '0',
        'UGC-AI-001',
        'course-category-ai',
        'instructor-author-demo-creator-2',
        'AI 写作训练营：从提纲到成稿',
        '2 课实战写作',
        '面向内容创作者的 AI 写作训练营，用 2 个真实选题练习结构、论据与润色，每次作业都有可复用的提示词模板。',
        '面向内容创作者的 AI 写作训练营，共 2 课、约 1.5 小时。第 1 课用三个问题判断选题是否值得写，第 2 课从一句核心判断出发搭建文章结构，每次练习都配有可复用的提示词模板与结构检查清单。',
        'beginner',
        'zh-CN',
        '["AI写作","训练营","UGC"]',
        'https://i2.hdslb.com/bfs/archive/970f4644108bd8aeef8d201e0b5df1ad4807f3b2.jpg',
        5400,
        2,
        0,
        '0',
        0,
        '0',
        'CNY',
        1,
        0,
        'standard',
        'demo-creator-2',
        '苏晚',
        (CURRENT_TIMESTAMP - INTERVAL '1 day')::text,
        1,
        'tenant',
        'reviewing',
        'active',
        CURRENT_TIMESTAMP::text,
        'demo-creator-2',
        CURRENT_TIMESTAMP::text,
        'demo-creator-2',
        0
    )
ON CONFLICT (id) DO UPDATE SET
    primary_instructor_id = EXCLUDED.primary_instructor_id,
    title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    description = EXCLUDED.description,
    estimated_duration_seconds = EXCLUDED.estimated_duration_seconds,
    lesson_count_snapshot = EXCLUDED.lesson_count_snapshot,
    cover_resource_snapshot = EXCLUDED.cover_resource_snapshot,
    author_user_id = EXCLUDED.author_user_id,
    author_display_name = EXCLUDED.author_display_name,
    submitted_at = EXCLUDED.submitted_at,
    publish_status = EXCLUDED.publish_status,
    updated_at = EXCLUDED.updated_at;

INSERT INTO course_section
    (
        id, uuid, tenant_id, organization_id, course_id, section_no, title,
        description, sort_order, lesson_count_snapshot, duration_seconds_snapshot,
        visibility, status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'section-ugc-ai-writing-01',
        'section-ugc-ai-writing-01',
        '100001',
        '0',
        'course-ugc-pending-ai-writing',
        'S0001',
        '开营与选题',
        '找到值得写、也有人愿意读的选题',
        0,
        2,
        5400,
        'tenant',
        'active',
        CURRENT_TIMESTAMP::text,
        'demo-creator-2',
        CURRENT_TIMESTAMP::text,
        'demo-creator-2',
        0
    )
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    lesson_count_snapshot = EXCLUDED.lesson_count_snapshot,
    duration_seconds_snapshot = EXCLUDED.duration_seconds_snapshot;

INSERT INTO course_lesson
    (
        id, uuid, tenant_id, organization_id, course_id, section_id, lesson_no,
        lesson_kind, title, description, content, duration_seconds, duration_text,
        free_preview, required_for_completion, completion_rule_json, sort_order,
        status, created_at, created_by, updated_at, updated_by, version
    )
VALUES
    (
        'lesson-ugc-ai-writing-01',
        'lesson-ugc-ai-writing-01',
        '100001',
        '0',
        'course-ugc-pending-ai-writing',
        'section-ugc-ai-writing-01',
        'L0001',
        'article',
        '第 1 课｜选题判断：什么值得写',
        '用三个问题筛掉自嗨型选题。',
        '一个选题是否值得写，取决于它是否同时满足：你有独特经验、读者有明确痛点、当下有讨论热度。本课用三个提问帮你快速判断，并给出选题卡模板。',
        2700,
        '45 分钟',
        1,
        1,
        '{}',
        1,
        'active',
        CURRENT_TIMESTAMP::text,
        'demo-creator-2',
        CURRENT_TIMESTAMP::text,
        'demo-creator-2',
        0
    ),
    (
        'lesson-ugc-ai-writing-02',
        'lesson-ugc-ai-writing-02',
        '100001',
        '0',
        'course-ugc-pending-ai-writing',
        'section-ugc-ai-writing-01',
        'L0002',
        'article',
        '第 2 课｜结构：让读者愿意读下去',
        '从一句判断长成一篇文章。',
        '先写出一句你希望读者记住的判断，再为它找三个支撑点，最后决定开头与结尾。本课提供结构检查清单，并用一篇示例文章逐段拆解。',
        2700,
        '45 分钟',
        0,
        1,
        '{}',
        2,
        'active',
        CURRENT_TIMESTAMP::text,
        'demo-creator-2',
        CURRENT_TIMESTAMP::text,
        'demo-creator-2',
        0
    )
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    content = EXCLUDED.content;
