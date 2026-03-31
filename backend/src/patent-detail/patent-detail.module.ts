import { Module } from '@nestjs/common';
import { PatentDetailController } from './patent-detail.controller';
import { PatentDetailService } from './patent-detail.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PatentDetailController],
  providers: [PatentDetailService],
  exports: [PatentDetailService],
})
export class PatentDetailModule {}
