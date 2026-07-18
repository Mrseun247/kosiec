require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const LGA = require('./models/LGA');
const TeamMember = require('./models/TeamMember');
const AdminLog = require('./models/AdminLog');
const { Setting } = require('./models/SharedModels');

const KOGI_LGAS = [
  { name: 'Adavi',           senatoralDistrict: 'Kogi Central', headquarters: 'Ogaminana',   totalWards: 10, lgaCode: 'KG-001' },
  { name: 'Ajaokuta',        senatoralDistrict: 'Kogi Central', headquarters: 'Ajaokuta',    totalWards: 9,  lgaCode: 'KG-002' },
  { name: 'Ankpa',           senatoralDistrict: 'Kogi East',    headquarters: 'Ankpa',       totalWards: 11, lgaCode: 'KG-003' },
  { name: 'Bassa',           senatoralDistrict: 'Kogi Central', headquarters: 'Oguma',       totalWards: 10, lgaCode: 'KG-004' },
  { name: 'Dekina',          senatoralDistrict: 'Kogi East',    headquarters: 'Dekina',      totalWards: 14, lgaCode: 'KG-005' },
  { name: 'Ibaji',           senatoralDistrict: 'Kogi East',    headquarters: 'Odu',         totalWards: 10, lgaCode: 'KG-006' },
  { name: 'Idah',            senatoralDistrict: 'Kogi East',    headquarters: 'Idah',        totalWards: 10, lgaCode: 'KG-007' },
  { name: 'Igalamela-Odolu', senatoralDistrict: 'Kogi East',    headquarters: 'Ajaka',       totalWards: 10, lgaCode: 'KG-008' },
  { name: 'Ijumu',           senatoralDistrict: 'Kogi West',    headquarters: 'Iyara',       totalWards: 10, lgaCode: 'KG-009' },
  { name: 'Kabba/Bunu',      senatoralDistrict: 'Kogi West',    headquarters: 'Kabba',       totalWards: 10, lgaCode: 'KG-010' },
  { name: 'Kogi',            senatoralDistrict: 'Kogi Central', headquarters: 'Koton Karfe', totalWards: 10, lgaCode: 'KG-011' },
  { name: 'Lokoja',          senatoralDistrict: 'Kogi Central', headquarters: 'Lokoja',      totalWards: 11, lgaCode: 'KG-012' },
  { name: 'Mopa-Muro',       senatoralDistrict: 'Kogi West',    headquarters: 'Mopa',        totalWards: 10, lgaCode: 'KG-013' },
  { name: 'Ofu',             senatoralDistrict: 'Kogi East',    headquarters: 'Ogurugu',     totalWards: 10, lgaCode: 'KG-014' },
  { name: 'Ogori/Magongo',   senatoralDistrict: 'Kogi Central', headquarters: 'Ogori',       totalWards: 5,  lgaCode: 'KG-015' },
  { name: 'Okehi',           senatoralDistrict: 'Kogi Central', headquarters: 'Ihima',       totalWards: 10, lgaCode: 'KG-016' },
  { name: 'Okene',           senatoralDistrict: 'Kogi Central', headquarters: 'Okene',       totalWards: 13, lgaCode: 'KG-017' },
  { name: 'Olamaboro',       senatoralDistrict: 'Kogi East',    headquarters: 'Abejukolo',   totalWards: 10, lgaCode: 'KG-018' },
  { name: 'Omala',           senatoralDistrict: 'Kogi East',    headquarters: 'Abule',       totalWards: 10, lgaCode: 'KG-019' },
  { name: 'Yagba East',      senatoralDistrict: 'Kogi West',    headquarters: 'Isanlu',      totalWards: 10, lgaCode: 'KG-020' },
  { name: 'Yagba West',      senatoralDistrict: 'Kogi West',    headquarters: 'Ogbe',        totalWards: 10, lgaCode: 'KG-021' },
];

const INITIAL_SETTINGS = [
  {
    key: 'ticker_messages',
    value: [
      '📢 KOSIEC announces 2026 LGA Election timetable — Registration begins July 15, 2026',
      '✅ 2025 Kogi LGA Elections completed across all 21 Local Government Areas',
      '📋 Voter registration exercise ongoing — Visit your LGA office to register',
      '🗳️ All eligible Kogi residents aged 18+ are encouraged to participate in local governance',
      '📞 For inquiries: Call 09169490757 or WhatsApp us 24/7',
    ],
    description: 'Scrolling ticker messages shown at the top of the website',
    isPublic: true,
  },
  {
    key: 'next_election_active',
    value: true,
    description: 'Whether the homepage countdown timer is shown',
    isPublic: true,
  },
  {
    key: 'next_election_date',
    value: '2026-07-31T08:00:00.000Z',
    description: 'Date of the next LGA election (ISO format)',
    isPublic: true,
  },
  {
    key: 'next_election_label',
    value: '2026 Kogi State LGA Elections',
    description: 'Display label for countdown timer',
    isPublic: true,
  },
  {
    key: 'contact_info',
    value: {
      phone1: '09169490757',
      phone2: '08035904252',
      email: 'erimamman2@gmail.com',
      address: 'No. 1 Ado Ibrahim Road, GRA, Lokoja, Kogi State, Nigeria',
      officeHours: 'Weekdays: 9:00am – 5:00pm',
      whatsapp: '2349169490757',
    },
    description: 'Commission contact details',
    isPublic: true,
  },
  {
    key: 'commission_stats',
    value: { lgas: 21, yearEstablished: 2004, staffCount: 25 },
    description: 'Key statistics shown on homepage',
    isPublic: true,
  },
  {
    key: 'site_maintenance',
    value: false,
    description: 'Set to true to show maintenance page to public',
    isPublic: false,
  },
];

const seed = async () => {
  await connectDB();
  console.log('\n🌱 Starting database seed...\n');

  try {
    // ── 1. Clear existing data ──────────────────────────────
    await Promise.all([
      User.deleteMany({}),
      LGA.deleteMany({}),
      TeamMember.deleteMany({}),
      Setting.deleteMany({}),
      AdminLog.deleteMany({}),
    ]);
    console.log('🗑️  Cleared: Users, LGAs, TeamMembers, Settings, AdminLogs');

    // ── 2. Seed LGAs ───────────────────────────────────────
    const lgas = await LGA.insertMany(KOGI_LGAS);
    console.log(`✅ Seeded ${lgas.length} LGAs`);

    // ── 3. Seed Super Admin ────────────────────────────────
    const superAdmin = await User.create({
      fullName: 'KOSIEC Super Admin',
      email: 'admin@kosiec.gov.ng',
      password: 'Kosiec@2026',
      role: 'super_admin',
      staffId: 'KOSIEC-SA-001',
    });
    console.log('✅ Super Admin created → admin@kosiec.gov.ng / Kosiec@2026');

    // ── 4. Seed Regular Admin ──────────────────────────────
    await User.create({
      fullName: 'Mamman Nda Eri',
      email: 'erimamman2@gmail.com',
      password: 'Kosiec@Chairman2026',
      role: 'admin',
      staffId: 'KOSIEC-CHAIR-001',
      phone: '09169490757',
    });
    console.log('✅ Chairman admin account created → erimamman2@gmail.com');

    // ── 5. Seed Chairman TeamMember record ─────────────────
    const lokoja = lgas.find((l) => l.name === 'Lokoja');
    await TeamMember.create({
      fullName: 'Mamman Nda Eri',
      title: 'Hon.',
      role: 'Chairman',
      roleCategory: 'commission',
      department: 'Commission',
      bio: 'Hon. Mamman Nda Eri is the Chairman of the Kogi State Independent Electoral Commission (KOSIEC). He oversees the conduct of free, fair, and credible Local Government elections across all 21 LGAs in Kogi State.',
      photo: null,           // ← will be updated via PUT /api/team/:id/photo
      email: 'erimamman2@gmail.com',
      phone: '09169490757',
      displayOrder: 1,
      isChairman: true,
      isActive: true,
      appointedDate: new Date('2004-01-01'),
    });
    console.log('✅ Chairman TeamMember record seeded (photo: pending upload)');

    // ── 6. Seed additional staff placeholders ──────────────
    await TeamMember.insertMany([
      {
        fullName: 'Secretary to the Commission',
        title: '',
        role: 'Commission Secretary',
        roleCategory: 'commission',
        bio: 'Coordinates the administrative functions and official communications of the Commission.',
        displayOrder: 2, isActive: true,
      },
      {
        fullName: 'Director of Operations',
        title: '',
        role: 'Director, Field Operations',
        roleCategory: 'directorate',
        bio: 'Oversees all field operations, logistics, and coordination of electoral activities across LGAs.',
        displayOrder: 3, isActive: true,
      },
      {
        fullName: 'Legal Adviser',
        title: 'Barr.',
        role: 'Commission Legal Adviser',
        roleCategory: 'directorate',
        bio: 'Provides legal guidance on electoral law, pre-election matters, and regulatory compliance.',
        displayOrder: 4, isActive: true,
      },
    ]);
    console.log('✅ Staff placeholder records seeded');

    // ── 7. Seed Settings ───────────────────────────────────
    await Setting.insertMany(
      INITIAL_SETTINGS.map((s) => ({ ...s, updatedBy: superAdmin._id }))
    );
    console.log('✅ Site settings seeded');

    // ── 8. Log the seed action itself ──────────────────────
    await AdminLog.create({
      user: superAdmin._id,
      email: superAdmin.email,
      fullName: superAdmin.fullName,
      role: superAdmin.role,
      action: 'create',
      resource: 'Database',
      details: 'Initial database seed executed (LGAs, users, team, settings).',
      success: true,
    });
    console.log('✅ Seed action recorded in AdminLog');

    console.log('\n🎉 Seed complete!\n');
    console.log('──────────────────────────────────────────────');
    console.log('  Super Admin   : admin@kosiec.gov.ng');
    console.log('  Password      : Kosiec@2026');
    console.log('  Chairman Login: erimamman2@gmail.com');
    console.log('  Password      : Kosiec@Chairman2026');
    console.log('  ⚠️  Change passwords immediately after first login!');
    console.log('──────────────────────────────────────────────\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
};

seed();
