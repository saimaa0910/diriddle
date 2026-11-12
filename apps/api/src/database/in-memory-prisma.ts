import { v4 as uuidv4 } from 'uuid';

type RecordRow = Record<string, any>;

const COMPOUND_KEYS: Record<string, Record<string, string[]>> = {
  anonymousIdentity: { userId_communityId: ['userId', 'communityId'] },
  communityMember: { userId_communityId: ['userId', 'communityId'] },
  reaction: { postId_userId: ['postId', 'userId'] },
  savedPost: { userId_postId: ['userId', 'postId'] },
  block: { blockerId_blockedId: ['blockerId', 'blockedId'] },
  deviceToken: { userId_token: ['userId', 'token'] },
  notificationPreference: { userId_notificationType: ['userId', 'notificationType'] },
  idempotencyKey: { userId_key: ['userId', 'key'] },
  pollVote: { pollId_userId: ['pollId', 'userId'] },
};

function matchesCondition(value: any, cond: any): boolean {
  if (cond === undefined) return true;
  if (cond === null) return value === null || value === undefined;
  if (typeof cond !== 'object' || cond instanceof Date) {
    if (value instanceof Date && cond instanceof Date) {
      return value.getTime() === cond.getTime();
    }
    return value === cond;
  }

  if ('equals' in cond) {
    if (!matchesCondition(value, cond.equals)) return false;
  }
  if ('not' in cond) {
    if (matchesCondition(value, cond.not)) return false;
  }
  if ('in' in cond && Array.isArray(cond.in)) {
    if (!cond.in.includes(value)) return false;
  }
  if ('notIn' in cond && Array.isArray(cond.notIn)) {
    if (cond.notIn.includes(value)) return false;
  }
  if ('gte' in cond) {
    if (value == null || new Date(value).getTime() < new Date(cond.gte).getTime()) return false;
  }
  if ('lte' in cond) {
    if (value == null || new Date(value).getTime() > new Date(cond.lte).getTime()) return false;
  }
  if ('gt' in cond) {
    if (value == null || new Date(value).getTime() <= new Date(cond.gt).getTime()) return false;
  }
  if ('lt' in cond) {
    if (value == null || new Date(value).getTime() >= new Date(cond.lt).getTime()) return false;
  }
  if ('contains' in cond) {
    if (typeof value !== 'string') return false;
    const needle = String(cond.contains);
    if (cond.mode === 'insensitive') {
      if (!value.toLowerCase().includes(needle.toLowerCase())) return false;
    } else if (!value.includes(needle)) {
      return false;
    }
  }
  return true;
}

function matchesWhere(row: RecordRow, where?: RecordRow, modelName?: string): boolean {
  if (!where) return true;
  for (const [key, val] of Object.entries(where)) {
    if (val === undefined) continue;
    if (key === 'AND') {
      const list = Array.isArray(val) ? val : [val];
      if (!list.every((sub) => matchesWhere(row, sub, modelName))) return false;
      continue;
    }
    if (key === 'OR') {
      const list = Array.isArray(val) ? val : [val];
      if (!list.some((sub) => matchesWhere(row, sub, modelName))) return false;
      continue;
    }
    if (key === 'NOT') {
      const list = Array.isArray(val) ? val : [val];
      if (list.some((sub) => matchesWhere(row, sub, modelName))) return false;
      continue;
    }

    const compound = modelName ? COMPOUND_KEYS[modelName]?.[key] : undefined;
    if (compound && val && typeof val === 'object') {
      for (const field of compound) {
        if (!matchesCondition(row[field], val[field])) return false;
      }
      continue;
    }

    if (!matchesCondition(row[key], val)) return false;
  }
  return true;
}

function compareValues(a: any, b: any): number {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function applyOrderBy(rows: RecordRow[], orderBy?: any): RecordRow[] {
  if (!orderBy) return rows;
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const order of orders) {
      for (const [field, dir] of Object.entries(order)) {
        const cmp = compareValues(a[field], b[field]);
        if (cmp !== 0) {
          return dir === 'desc' ? -cmp : cmp;
        }
      }
    }
    return 0;
  });
}

function applySelect(row: RecordRow, select?: RecordRow): RecordRow {
  if (!select) return row;
  const result: RecordRow = {};
  for (const [key, enabled] of Object.entries(select)) {
    if (enabled) {
      result[key] = row[key];
    }
  }
  return result;
}

export class InMemoryPrismaStore {
  private tables: Record<string, RecordRow[]> = {
    user: [],
    anonymousIdentity: [],
    community: [],
    communityMember: [],
    post: [],
    postMedia: [],
    comment: [],
    reaction: [],
    savedPost: [],
    report: [],
    block: [],
    notification: [],
    deviceToken: [],
    notificationPreference: [],
    moderationAction: [],
    moderationAppeal: [],
    auditLog: [],
    userConsent: [],
    locationPreference: [],
    idempotencyKey: [],
    poll: [],
    pollOption: [],
    pollVote: [],
    adminRole: [],
  };

  user = this.createDelegate('user');
  anonymousIdentity = this.createDelegate('anonymousIdentity');
  community = this.createDelegate('community');
  communityMember = this.createDelegate('communityMember');
  post = this.createDelegate('post');
  postMedia = this.createDelegate('postMedia');
  comment = this.createDelegate('comment');
  reaction = this.createDelegate('reaction');
  savedPost = this.createDelegate('savedPost');
  report = this.createDelegate('report');
  block = this.createDelegate('block');
  notification = this.createDelegate('notification');
  deviceToken = this.createDelegate('deviceToken');
  notificationPreference = this.createDelegate('notificationPreference');
  moderationAction = this.createDelegate('moderationAction');
  moderationAppeal = this.createDelegate('moderationAppeal');
  auditLog = this.createDelegate('auditLog');
  userConsent = this.createDelegate('userConsent');
  locationPreference = this.createDelegate('locationPreference');
  idempotencyKey = this.createDelegate('idempotencyKey');
  poll = this.createDelegate('poll');
  pollOption = this.createDelegate('pollOption');
  pollVote = this.createDelegate('pollVote');
  adminRole = this.createDelegate('adminRole');

  constructor() {
    this.seed();
  }

  async $connect(): Promise<void> {
    return;
  }

  async $disconnect(): Promise<void> {
    return;
  }

  async $transaction<T>(fnOrOps: ((tx: this) => Promise<T>) | Promise<any>[]): Promise<any> {
    if (typeof fnOrOps === 'function') {
      return fnOrOps(this);
    }
    return Promise.all(fnOrOps);
  }

  reset(): void {
    for (const key of Object.keys(this.tables)) {
      this.tables[key] = [];
    }
    this.seed();
  }

  private hydrateRow(modelName: string, row: RecordRow, include?: RecordRow): RecordRow {
    const copy: RecordRow = { ...row };
    if (!include) return copy;

    if (modelName === 'user') {
      if (include.adminRole) {
        copy.adminRole = this.tables.adminRole.find((r) => r.userId === row.id) ?? null;
      }
      if (include.locationPreference) {
        copy.locationPreference =
          this.tables.locationPreference.find((l) => l.userId === row.id) ?? null;
      }
    }

    if (modelName === 'post') {
      if (include.anonymousIdentity) {
        copy.anonymousIdentity =
          this.tables.anonymousIdentity.find((i) => i.id === row.anonymousIdentityId) ?? null;
      }
      if (include.community) {
        copy.community = this.tables.community.find((c) => c.id === row.communityId) ?? null;
      }
      if (include.poll) {
        const poll = this.tables.poll.find((p) => p.postId === row.id) ?? null;
        if (poll) {
          copy.poll = {
            ...poll,
            options: this.tables.pollOption.filter((o) => o.pollId === poll.id),
          };
        } else {
          copy.poll = null;
        }
      }
      if (include._count?.select) {
        const countSel = include._count.select;
        copy._count = {};
        if (countSel.comments) {
          copy._count.comments = this.tables.comment.filter(
            (c) => c.postId === row.id && !c.deletedAt && c.status === 'ACTIVE',
          ).length;
        }
        if (countSel.reactions) {
          copy._count.reactions = this.tables.reaction.filter((r) => r.postId === row.id).length;
        }
      }
    }

    if (modelName === 'comment') {
      if (include.anonymousIdentity) {
        copy.anonymousIdentity =
          this.tables.anonymousIdentity.find((i) => i.id === row.anonymousIdentityId) ?? null;
      }
      if (include.post) {
        copy.post = this.tables.post.find((p) => p.id === row.postId) ?? null;
      }
      if (include.replies) {
        const replySpec = typeof include.replies === 'object' ? include.replies : {};
        const replies = this.tables.comment.filter(
          (r) => r.parentCommentId === row.id && matchesWhere(r, replySpec.where, 'comment'),
        );
        copy.replies = replies.map((r) => this.hydrateRow('comment', r, replySpec.include));
      }
    }

    if (modelName === 'community') {
      if (include._count?.select) {
        const countSel = include._count.select;
        copy._count = {};
        if (countSel.members) {
          copy._count.members = this.tables.communityMember.filter(
            (m) => m.communityId === row.id && m.status === 'ACTIVE',
          ).length;
        }
        if (countSel.posts) {
          copy._count.posts = this.tables.post.filter(
            (p) => p.communityId === row.id && p.status === 'PUBLISHED' && !p.deletedAt,
          ).length;
        }
      }
    }

    if (modelName === 'anonymousIdentity' && include.community) {
      copy.community = row.communityId
        ? this.tables.community.find((c) => c.id === row.communityId) ?? null
        : null;
    }

    if (modelName === 'savedPost' && include.post) {
      const post = this.tables.post.find((p) => p.id === row.postId) ?? null;
      copy.post = post
        ? this.hydrateRow(
            'post',
            post,
            typeof include.post === 'object' ? include.post.include : undefined,
          )
        : null;
    }

    if (modelName === 'moderationAppeal' && include.moderationAction) {
      copy.moderationAction =
        this.tables.moderationAction.find((m) => m.id === row.moderationActionId) ?? null;
    }

    return copy;
  }

  private createDelegate(modelName: string) {
    const getRows = () => this.tables[modelName];

    return {
      findUnique: async (args: any = {}) => {
        const row = getRows().find((r) => matchesWhere(r, args.where, modelName));
        if (!row) return null;
        const hydrated = this.hydrateRow(modelName, row, args.include);
        return args.select ? applySelect(hydrated, args.select) : hydrated;
      },

      findFirst: async (args: any = {}) => {
        let rows = getRows().filter((r) => matchesWhere(r, args.where, modelName));
        rows = applyOrderBy(rows, args.orderBy);
        const row = rows[0];
        if (!row) return null;
        const hydrated = this.hydrateRow(modelName, row, args.include);
        return args.select ? applySelect(hydrated, args.select) : hydrated;
      },

      findMany: async (args: any = {}) => {
        let rows = getRows().filter((r) => matchesWhere(r, args.where, modelName));
        rows = applyOrderBy(rows, args.orderBy);
        if (typeof args.skip === 'number') {
          rows = rows.slice(args.skip);
        }
        if (typeof args.take === 'number') {
          rows = rows.slice(0, args.take);
        }
        return rows.map((r) => {
          const hydrated = this.hydrateRow(modelName, r, args.include);
          return args.select ? applySelect(hydrated, args.select) : hydrated;
        });
      },

      create: async (args: any) => {
        const now = new Date();
        const data = { ...args.data };
        const row: RecordRow = {
          id: data.id ?? uuidv4(),
          createdAt: data.createdAt ?? now,
          updatedAt: data.updatedAt ?? now,
          ...data,
        };
        if (modelName === 'user') {
          row.status = row.status ?? 'ACTIVE';
          row.ageVerified = row.ageVerified ?? false;
          row.deletedAt = row.deletedAt ?? null;
        }
        if (modelName === 'post') {
          row.status = row.status ?? 'PUBLISHED';
          row.visibility = row.visibility ?? 'COMMUNITY';
          row.commentsEnabled = row.commentsEnabled ?? true;
          row.deletedAt = row.deletedAt ?? null;
        }
        if (modelName === 'comment') {
          row.status = row.status ?? 'ACTIVE';
          row.deletedAt = row.deletedAt ?? null;
          row.parentCommentId = row.parentCommentId ?? null;
        }
        if (modelName === 'report') {
          row.status = row.status ?? 'RECEIVED';
          row.priority = row.priority ?? 'NORMAL';
          row.resolvedAt = row.resolvedAt ?? null;
        }
        if (modelName === 'notification') {
          row.payload = row.payload ?? {};
          row.readAt = row.readAt ?? null;
        }
        if (modelName === 'moderationAppeal') {
          row.status = row.status ?? 'PENDING';
        }
        if (modelName === 'community') {
          row.status = row.status ?? 'ACTIVE';
        }

        getRows().push(row);
        const hydrated = this.hydrateRow(modelName, row, args.include);
        return args.select ? applySelect(hydrated, args.select) : hydrated;
      },

      update: async (args: any) => {
        const idx = getRows().findIndex((r) => matchesWhere(r, args.where, modelName));
        if (idx === -1) {
          throw new Error(`Record not found in ${modelName}`);
        }
        const updated = {
          ...getRows()[idx],
          ...args.data,
          updatedAt: new Date(),
        };
        getRows()[idx] = updated;
        const hydrated = this.hydrateRow(modelName, updated, args.include);
        return args.select ? applySelect(hydrated, args.select) : hydrated;
      },

      updateMany: async (args: any) => {
        let count = 0;
        this.tables[modelName] = getRows().map((r) => {
          if (matchesWhere(r, args.where, modelName)) {
            count++;
            return { ...r, ...args.data, updatedAt: new Date() };
          }
          return r;
        });
        return { count };
      },

      upsert: async (args: any) => {
        const idx = getRows().findIndex((r) => matchesWhere(r, args.where, modelName));
        if (idx !== -1) {
          const updated = {
            ...getRows()[idx],
            ...args.update,
            updatedAt: new Date(),
          };
          getRows()[idx] = updated;
          return this.hydrateRow(modelName, updated, args.include);
        }
        const delegate = this.createDelegate(modelName);
        return delegate.create({ data: args.create, include: args.include });
      },

      delete: async (args: any) => {
        const idx = getRows().findIndex((r) => matchesWhere(r, args.where, modelName));
        if (idx === -1) {
          throw new Error(`Record not found in ${modelName}`);
        }
        const [removed] = getRows().splice(idx, 1);
        return removed;
      },

      deleteMany: async (args: any = {}) => {
        const before = getRows().length;
        this.tables[modelName] = getRows().filter(
          (r) => !matchesWhere(r, args.where, modelName),
        );
        return { count: before - this.tables[modelName].length };
      },

      count: async (args: any = {}) => {
        return getRows().filter((r) => matchesWhere(r, args.where, modelName)).length;
      },

      groupBy: async (args: any) => {
        const rows = getRows().filter((r) => matchesWhere(r, args.where, modelName));
        const byFields: string[] = Array.isArray(args.by) ? args.by : [args.by];
        const groups = new Map<string, { keys: RecordRow; count: number }>();

        for (const row of rows) {
          const keyObj: RecordRow = {};
          for (const f of byFields) {
            keyObj[f] = row[f];
          }
          const mapKey = JSON.stringify(keyObj);
          const existing = groups.get(mapKey);
          if (existing) {
            existing.count += 1;
          } else {
            groups.set(mapKey, { keys: keyObj, count: 1 });
          }
        }

        return Array.from(groups.values()).map((g) => ({
          ...g.keys,
          _count: g.count,
        }));
      },
    };
  }

  private seed(): void {
    const now = new Date();
    const cities = [
      { id: 'comm-mumbai', name: 'Mumbai', slug: 'mumbai', type: 'CITY', city: 'Mumbai', state: 'Maharashtra', geoCell: 'h3_in_mumbai_01' },
      { id: 'comm-delhi', name: 'Delhi', slug: 'delhi', type: 'CITY', city: 'Delhi', state: 'Delhi', geoCell: 'h3_in_delhi_01' },
      { id: 'comm-bengaluru', name: 'Bengaluru', slug: 'bengaluru', type: 'CITY', city: 'Bengaluru', state: 'Karnataka', geoCell: 'h3_in_blr_01' },
      { id: 'comm-hyderabad', name: 'Hyderabad', slug: 'hyderabad', type: 'CITY', city: 'Hyderabad', state: 'Telangana', geoCell: 'h3_in_hyd_01' },
      { id: 'comm-chennai', name: 'Chennai', slug: 'chennai', type: 'CITY', city: 'Chennai', state: 'Tamil Nadu', geoCell: 'h3_in_maa_01' },
      { id: 'comm-kolkata', name: 'Kolkata', slug: 'kolkata', type: 'CITY', city: 'Kolkata', state: 'West Bengal', geoCell: 'h3_in_ccu_01' },
      { id: 'comm-pune', name: 'Pune', slug: 'pune', type: 'CITY', city: 'Pune', state: 'Maharashtra', geoCell: 'h3_in_pnq_01' },
      { id: 'comm-ahmedabad', name: 'Ahmedabad', slug: 'ahmedabad', type: 'CITY', city: 'Ahmedabad', state: 'Gujarat', geoCell: 'h3_in_amd_01' },
      { id: 'comm-jaipur', name: 'Jaipur', slug: 'jaipur', type: 'CITY', city: 'Jaipur', state: 'Rajasthan', geoCell: 'h3_in_jai_01' },
      { id: 'comm-lucknow', name: 'Lucknow', slug: 'lucknow', type: 'CITY', city: 'Lucknow', state: 'Uttar Pradesh', geoCell: 'h3_in_lko_01' },
      { id: 'comm-koramangala', name: 'Koramangala', slug: 'koramangala-blr', type: 'NEIGHBORHOOD', city: 'Bengaluru', state: 'Karnataka', geoCell: 'h3_in_blr_krm' },
      { id: 'comm-indiranagar', name: 'Indiranagar', slug: 'indiranagar-blr', type: 'NEIGHBORHOOD', city: 'Bengaluru', state: 'Karnataka', geoCell: 'h3_in_blr_ind' },
      { id: 'comm-bandra', name: 'Bandra West', slug: 'bandra-west-bom', type: 'NEIGHBORHOOD', city: 'Mumbai', state: 'Maharashtra', geoCell: 'h3_in_bom_ban' },
      { id: 'comm-iitb', name: 'IIT Bombay Campus', slug: 'iit-bombay', type: 'CAMPUS', city: 'Mumbai', state: 'Maharashtra', geoCell: 'h3_in_bom_iit' },
      { id: 'comm-hauzkhas', name: 'Hauz Khas', slug: 'hauz-khas-del', type: 'NEIGHBORHOOD', city: 'Delhi', state: 'Delhi', geoCell: 'h3_in_del_hk' },
    ];

    for (const c of cities) {
      this.tables.community.push({ ...c, status: 'ACTIVE', createdAt: now });
    }

    const demoUserId = 'user-demo-admin';
    this.tables.user.push({
      id: demoUserId,
      authId: 'phone:+919876543210',
      status: 'ACTIVE',
      ageVerified: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    this.tables.adminRole.push({
      id: 'role-demo-superadmin',
      userId: demoUserId,
      role: 'SUPER_ADMIN',
      scope: 'PLATFORM',
      scopeId: null,
      grantedAt: now,
      expiresAt: null,
    });

    const demoCommunityIds = ['comm-bengaluru', 'comm-mumbai', 'comm-delhi', 'comm-hyderabad', 'comm-iitb'];
    const demoPosts = [
      {
        id: 'post-demo-1',
        communityId: 'comm-bengaluru',
        category: 'CONFESSION',
        content: 'Left a startup job in Koramangala after 3 years and honestly just sitting at Third Wave Coffee all afternoon feels unreal.',
      },
      {
        id: 'post-demo-2',
        communityId: 'comm-mumbai',
        category: 'LOCAL_ALERT',
        content: 'Heavy waterlogging near Western Express Highway Andheri flyover — take the metro if heading south.',
      },
      {
        id: 'post-demo-3',
        communityId: 'comm-delhi',
        category: 'QUESTION',
        content: 'Which library or quiet cafe in South Delhi stays open past 11 PM without blasting EDM?',
      },
      {
        id: 'post-demo-4',
        communityId: 'comm-hyderabad',
        category: 'NEIGHBORHOOD',
        content: 'Evening Irani chai + Osmania biscuit meetup near Madhapur lake walking track was unexpectedly wholesome.',
      },
      {
        id: 'post-demo-5',
        communityId: 'comm-iitb',
        category: 'CAMPUS',
        content: 'Midsem week energy in Hostel 5: everyone pretends to study while debating Maggi recipes at 2 AM.',
      },
    ];

    demoCommunityIds.forEach((cid, idx) => {
      this.tables.communityMember.push({
        id: `member-demo-${idx + 1}`,
        userId: demoUserId,
        communityId: cid,
        status: 'ACTIVE',
        joinedAt: now,
      });
      this.tables.anonymousIdentity.push({
        id: `ident-demo-${idx + 1}`,
        userId: demoUserId,
        communityId: cid,
        displayCode: `Anonymous #${String(1001 + idx).padStart(4, '0')}`,
        createdAt: now,
      });
    });

    demoPosts.forEach((p, idx) => {
      this.tables.post.push({
        id: p.id,
        userId: demoUserId,
        anonymousIdentityId: `ident-demo-${idx + 1}`,
        communityId: p.communityId,
        category: p.category,
        content: p.content,
        status: 'PUBLISHED',
        visibility: 'COMMUNITY',
        commentsEnabled: true,
        geoCell: null,
        expiresAt: null,
        createdAt: new Date(now.getTime() - idx * 60000),
        updatedAt: now,
        deletedAt: null,
      });
    });
  }
}
