#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { InfraStack } from '../lib/infra-stack';
import { ENV_CONFIG } from '../lib/config';

const app = new cdk.App();

// Resolve env name from environment variable (CDK_ENV)
const envName = process.env.CDK_ENV || 'dev';

// Load config from cdk.json context
//const envConfig = app.node.tryGetContext('envs')[envName];

// Load config from code (not cdk.json context)
const envConfig = ENV_CONFIG[envName];

if (!envConfig) {
  throw new Error(`❌ No environment configuration found for: ${envName}`);
}

new InfraStack(app, `PersonalWebsite-${envName}`, {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-1' },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: `Personal Website Infra for ${envName}`,
  tags: {
    Environment: envName,
    Project: 'personal-website',
  },
  stackName: `personal-website-${envName}`,
});