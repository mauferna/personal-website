import { EnvironmentConfig } from './types';

export const ENV_CONFIG: Record<string, EnvironmentConfig> = {
  dev: {
    domainName: 'dev.mauferna.com',
    bucketName: 'site-dev-mauferna',
    zoneName: 'mauferna.com',
    zoneId: 'Z0211134QYCE64SAULSE',
    recordNames: ['www.dev', 'dev'],
  },
  prod: {
    domainName: 'mauferna.com',
    bucketName: 'site-prod-mauferna',
    zoneName: 'mauferna.com',
    zoneId: 'Z0211134QYCE64SAULSE',
    recordNames: ['www', ''],
  },
};