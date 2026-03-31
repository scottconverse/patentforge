import { IsOptional, IsString, IsInt, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  anthropicApiKey?: string;

  @IsOptional()
  @IsString()
  defaultModel?: string;

  @IsOptional()
  @IsString()
  researchModel?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxTokens?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  interStageDelaySeconds?: number;

  @IsOptional()
  @IsString()
  exportPath?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  costCapUsd?: number;

}
