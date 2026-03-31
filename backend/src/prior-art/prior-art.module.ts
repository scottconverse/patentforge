import { Module } from '@nestjs/common';
import { PriorArtController } from './prior-art.controller';
import { PriorArtService } from './prior-art.service';
import { PriorArtSseService } from './prior-art-sse.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PriorArtController],
  providers: [PriorArtService, PriorArtSseService],
  exports: [PriorArtService, PriorArtSseService],
})
export class PriorArtModule {}
