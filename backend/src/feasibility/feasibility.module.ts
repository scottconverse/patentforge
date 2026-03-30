import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FeasibilityController } from './feasibility.controller';
import { FeasibilityService } from './feasibility.service';

@Module({
  imports: [PrismaModule],
  controllers: [FeasibilityController],
  providers: [FeasibilityService],
  exports: [FeasibilityService],
})
export class FeasibilityModule {}
