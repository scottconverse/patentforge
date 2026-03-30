import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { FeasibilityModule } from './feasibility/feasibility.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [PrismaModule, ProjectsModule, FeasibilityModule, SettingsModule],
})
export class AppModule {}
