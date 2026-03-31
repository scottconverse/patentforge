import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { FeasibilityModule } from './feasibility/feasibility.module';
import { SettingsModule } from './settings/settings.module';
import { PriorArtModule } from './prior-art/prior-art.module';
import { PatentDetailModule } from './patent-detail/patent-detail.module';

@Module({
  imports: [PrismaModule, ProjectsModule, FeasibilityModule, SettingsModule, PriorArtModule, PatentDetailModule],
})
export class AppModule {}
