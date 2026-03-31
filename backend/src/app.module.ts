import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { FeasibilityModule } from './feasibility/feasibility.module';
import { SettingsModule } from './settings/settings.module';
import { PriorArtModule } from './prior-art/prior-art.module';

@Module({
  imports: [PrismaModule, ProjectsModule, FeasibilityModule, SettingsModule, PriorArtModule],
})
export class AppModule {}
