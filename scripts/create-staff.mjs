// scripts/create-staff.mjs
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** соответствие цифры роли → slug */
const powerToSlug = {
  5: 'director',
  4: 'deputy_plus',
  3: 'deputy',
  2: 'teacher_plus',
  1: 'teacher',
};

/** пользователи для загрузки */
const people = [
  { name: 'Каминов Айткали Айбасович', username: 'kaminov',  rolePower: 5 },
  { name: 'Сенатор Вячеслав Александрович', username: 'senator',  rolePower: 4 },
  { name: 'Фартушный Владислав Сергеевич', username: 'fartushny', rolePower: 3 },
  { name: 'Носкова Дария Сергеевна',       username: 'noskova',   rolePower: 2 },
  { name: 'Курашева Любовь Вадимовна',     username: 'kurasheva', rolePower: 1 },
  // вы — зам.+, но с полными правами (root)
  { name: 'Евжик Иван Сергеевич',          username: 'evzhik',    rolePower: 4, isRoot: true },
];

const PASSWORD = 'test1';

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);

  for (const p of people) {
    const slug = powerToSlug[p.rolePower];
    if (!slug) {
      console.warn(`Пропускаю ${p.name}: неизвестная роль ${p.rolePower}`);
      continue;
    }

    // найдём роль в справочнике (если есть)
    const roleRow = await prisma.role.findFirst({ where: { slug } });

    // ищем пользователя по username или имени
    const existing = await prisma.user.findFirst({
      where: { OR: [{ username: p.username }, { name: p.name }] },
    });

    let user;
    if (existing) {
      user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: p.name,
          username: p.username,
          role: slug,                 // строковое поле для быстрой авторизации
          passwordHash: hash,
          isRoot: !!p.isRoot,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          name: p.name,
          username: p.username,
          role: slug,
          passwordHash: hash,
          isRoot: !!p.isRoot,
        },
      });
    }

    // Для совместимости — создадим связь в UserRole, если таблица и запись роли существуют
    if (roleRow) {
      try {
        await prisma.userRole.create({
          data: { userId: user.id, roleId: roleRow.id },
        });
      } catch (e) {
        // дубликаты/ограничения — не критично, просто пропустим
      }
    }

    console.log(`✓ ${p.name} (${p.username}) → ${slug}${p.isRoot ? ' [ROOT]' : ''}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
