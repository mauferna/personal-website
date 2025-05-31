import { Construct } from 'constructs';
import { EnvironmentConfig } from './types';
import { ENV_CONFIG } from './config';

export function getEnvConfig(scope: Construct): EnvironmentConfig {
  const envName = scope.node.tryGetContext('envName') || 'dev';
  const config = ENV_CONFIG[envName];
  if (!config) {
    throw new Error(`Missing environment config for: ${envName}`);
  }
  return config;
}