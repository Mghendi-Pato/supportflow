import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotificationPrefsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() emailNewTicket?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() emailStatusChanged?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() emailAssigned?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() emailNewMessage?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() emailNewAttachment?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() emailBillingRequest?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() emailPaymentUpdate?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() emailTicketClosed?: boolean;
}
