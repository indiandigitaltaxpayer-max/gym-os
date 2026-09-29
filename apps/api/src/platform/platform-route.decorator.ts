import { SetMetadata } from "@nestjs/common";

export const IS_PLATFORM_ROUTE = "isPlatformRoute";
export const PlatformRoute = () => SetMetadata(IS_PLATFORM_ROUTE, true);
