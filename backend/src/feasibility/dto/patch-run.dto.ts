import { IsOptional, IsString, IsDateString } from 'class-validator';

export class PatchRunDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  finalReport?: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
