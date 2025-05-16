import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { IHostedZone } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export function createCertificate(scope: Construct, zone: IHostedZone, domainName: string) {
  return new Certificate(scope, 'SiteCert', {
    domainName,
    subjectAlternativeNames: [`*.${domainName}`],
    validation: CertificateValidation.fromDns(zone),
  });
}