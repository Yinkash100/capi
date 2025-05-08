import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Check if admin already exists
  const adminExists = await prisma.user.findUnique({
    where: {
      email: 'admin@example.com',
    },
  });

  if (!adminExists) {
    // Create default admin user
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    
    await prisma.user.create({
      data: {
        email: 'admin@example.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        country: 'Admin Land',
        role: Role.ADMIN,
        isVerified: true, // Admin is auto-verified
      },
    });
    
    console.log('Default admin user created');
  } else {
    console.log('Admin user already exists');
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