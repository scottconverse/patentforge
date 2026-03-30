import { IsOptional, IsString, IsBoolean, IsDateString } from 'class-validator';

export class PatchStageDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  outputText?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsBoolean()
  webSearchUsed?: boolean;

  @IsOptional()
  @IsString()
  errorMessage?: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
