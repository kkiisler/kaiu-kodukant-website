# AWS Setup Guide for Calendar S3 Integration

## Overview
This guide covers the AWS configuration needed to serve calendar data from S3 via CloudFront, using your existing Pilvio infrastructure.

## Prerequisites
- Access to Pilvio AWS account
- Existing S3 bucket (pilvio-bucket or your bucket name)
- AWS CLI installed (optional but helpful)
- Domain control for DNS/CloudFront setup

---

## Step 1: IAM User Creation

### 1.1 Create Dedicated IAM User

**Via AWS Console:**
1. Navigate to IAM → Users → Add User
2. User name: `kaiu-calendar-sync`
3. Access type: Programmatic access only
4. Don't attach any policies yet (we'll create a custom one)

**Via AWS CLI:**
```bash
aws iam create-user --user-name kaiu-calendar-sync
```

### 1.2 Create Minimal Permission Policy

Create policy named `KaiuCalendarS3WritePolicy`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCalendarUpload",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ],
      "Resource": [
        "arn:aws:s3:::PILVIO_BUCKET_NAME/sites/kaiu-kodukant/calendar/*"
      ]
    },
    {
      "Sid": "AllowListBucket",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::PILVIO_BUCKET_NAME"
      ],
      "Condition": {
        "StringLike": {
          "s3:prefix": [
            "sites/kaiu-kodukant/calendar/*"
          ]
        }
      }
    }
  ]
}
```

**Replace `PILVIO_BUCKET_NAME` with your actual bucket name**

### 1.3 Attach Policy to User

```bash
aws iam attach-user-policy \
  --user-name kaiu-calendar-sync \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/KaiuCalendarS3WritePolicy
```

### 1.4 Generate Access Keys

```bash
aws iam create-access-key --user-name kaiu-calendar-sync
```

**Save these securely for Apps Script:**
- Access Key ID: `AKIA...`
- Secret Access Key: `wJalr...`

---

## Step 2: S3 Bucket Configuration

### 2.1 Create Folder Structure

Using your existing Pilvio bucket:

```bash
# Create calendar directory structure
aws s3api put-object \
  --bucket PILVIO_BUCKET_NAME \
  --key sites/kaiu-kodukant/calendar/
```

### 2.2 Configure Bucket Policy for CloudFront

Add this statement to your existing bucket policy to allow CloudFront access:

```json
{
  "Sid": "AllowCloudFrontOAC",
  "Effect": "Allow",
  "Principal": {
    "Service": "cloudfront.amazonaws.com"
  },
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::PILVIO_BUCKET_NAME/sites/kaiu-kodukant/calendar/*",
  "Condition": {
    "StringEquals": {
      "aws:SourceArn": "arn:aws:cloudfront::YOUR_ACCOUNT_ID:distribution/YOUR_DISTRIBUTION_ID"
    }
  }
}
```

### 2.3 Configure CORS (if serving directly from S3)

**Note: If using CloudFront, configure CORS there instead**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <CORSRule>
    <AllowedOrigin>https://kaiukodukant.ee</AllowedOrigin>
    <AllowedOrigin>https://www.kaiukodukant.ee</AllowedOrigin>
    <AllowedOrigin>https://tore.kaiukodukant.ee</AllowedOrigin>
    <AllowedOrigin>http://localhost:*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <MaxAgeSeconds>86400</MaxAgeSeconds>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <ExposeHeader>Last-Modified</ExposeHeader>
    <ExposeHeader>Cache-Control</ExposeHeader>
  </CORSRule>
</CORSConfiguration>
```

Apply CORS configuration:
```bash
aws s3api put-bucket-cors \
  --bucket PILVIO_BUCKET_NAME \
  --cors-configuration file://cors.xml
```

### 2.4 Enable Versioning (Optional but Recommended)

```bash
aws s3api put-bucket-versioning \
  --bucket PILVIO_BUCKET_NAME \
  --versioning-configuration Status=Enabled
```

---

## Step 3: CloudFront Distribution Setup

### 3.1 Create Distribution

**Via AWS Console:**

1. Navigate to CloudFront → Create Distribution
2. **Origin Settings:**
   - Origin Domain: `PILVIO_BUCKET_NAME.s3.eu-central-1.amazonaws.com`
   - Origin Path: `/sites/kaiu-kodukant/calendar`
   - Origin Access: Origin Access Control (recommended)
   - Create new OAC if needed

3. **Default Cache Behavior:**
   - Viewer Protocol Policy: Redirect HTTP to HTTPS
   - Allowed HTTP Methods: GET, HEAD, OPTIONS
   - Cache Policy: Create custom (see below)
   - Origin Request Policy: CORS-S3Origin
   - Response Headers Policy: CORS-With-Preflight

4. **Distribution Settings:**
   - Price Class: Use Only North America and Europe
   - Alternate Domain Names: `calendar.kaiukodukant.ee` (optional)
   - Custom SSL Certificate: Use existing or request new
   - Security Policy: TLSv1.2_2021
   - HTTP/2: Enabled
   - IPv6: Enabled

### 3.2 Create Custom Cache Policy

**Name:** `KaiuCalendarCachePolicy`

```json
{
  "Comment": "Cache policy for Kaiu calendar JSON",
  "DefaultTTL": 900,
  "MaxTTL": 3600,
  "MinTTL": 1,
  "ParametersInCacheKeyAndForwardedToOrigin": {
    "EnableAcceptEncodingGzip": true,
    "EnableAcceptEncodingBrotli": true,
    "QueryStringsConfig": {
      "QueryStringBehavior": "whitelist",
      "QueryStrings": ["v", "version"]
    },
    "HeadersConfig": {
      "HeaderBehavior": "none"
    },
    "CookiesConfig": {
      "CookieBehavior": "none"
    }
  }
}
```

### 3.3 Configure Response Headers Policy

Create or use existing CORS policy:

```json
{
  "ResponseHeadersPolicyConfig": {
    "Name": "KaiuCalendarCORS",
    "Comment": "CORS headers for calendar API",
    "CorsConfig": {
      "AccessControlAllowOrigins": {
        "Items": [
          "https://kaiukodukant.ee",
          "https://www.kaiukodukant.ee",
          "https://tore.kaiukodukant.ee"
        ]
      },
      "AccessControlAllowHeaders": {
        "Items": ["*"]
      },
      "AccessControlAllowMethods": {
        "Items": ["GET", "HEAD", "OPTIONS"]
      },
      "AccessControlMaxAgeSec": 86400,
      "AccessControlAllowCredentials": false,
      "OriginOverride": false
    },
    "CustomHeadersConfig": {
      "Items": [
        {
          "Header": "Cache-Control",
          "Value": "public, max-age=900, s-maxage=900",
          "Override": false
        },
        {
          "Header": "X-Content-Type-Options",
          "Value": "nosniff",
          "Override": true
        }
      ]
    }
  }
}
```

### 3.4 Set Up Custom Domain (Optional)

If using `calendar.kaiukodukant.ee`:

1. Request/Import SSL certificate in ACM (us-east-1 region)
2. Add CNAME to CloudFront distribution
3. Update DNS:
   ```
   calendar.kaiukodukant.ee CNAME d1234567890.cloudfront.net
   ```

---

## Step 4: Origin Access Control (OAC) Setup

### 4.1 Create OAC

```bash
aws cloudfront create-origin-access-control \
  --origin-access-control-config \
  Name="KaiuCalendarOAC",\
  Description="OAC for Kaiu calendar",\
  SigningProtocol="sigv4",\
  SigningBehavior="always",\
  OriginAccessControlOriginType="s3"
```

### 4.2 Update S3 Bucket Policy

After creating the distribution, update the bucket policy with the actual distribution ARN:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::PILVIO_BUCKET_NAME/sites/kaiu-kodukant/calendar/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
        }
      }
    }
  ]
}
```

---

## Step 5: Security Configuration

### 5.1 AWS Secrets Manager (Optional)

Store credentials securely instead of in Apps Script:

```bash
aws secretsmanager create-secret \
  --name kaiu-calendar-sync-credentials \
  --description "Credentials for Kaiu calendar S3 sync" \
  --secret-string '{
    "accessKeyId":"AKIA...",
    "secretAccessKey":"wJalr...",
    "region":"eu-central-1",
    "bucket":"PILVIO_BUCKET_NAME"
  }'
```

### 5.2 CloudWatch Monitoring

Create alarms for:
- Failed S3 uploads
- High CloudFront error rate
- Unusual traffic patterns

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name kaiu-calendar-upload-failures \
  --alarm-description "Alert on calendar upload failures" \
  --metric-name 4xxErrorRate \
  --namespace AWS/CloudFront \
  --statistic Average \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

---

## Step 6: Testing & Validation

### 6.1 Test S3 Upload

```bash
# Create test file
echo '{"test":true,"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' > test-calendar.json

# Upload with AWS CLI using sync user credentials
AWS_ACCESS_KEY_ID=AKIA... \
AWS_SECRET_ACCESS_KEY=wJalr... \
aws s3 cp test-calendar.json \
  s3://PILVIO_BUCKET_NAME/sites/kaiu-kodukant/calendar/test.json \
  --cache-control "public, max-age=900" \
  --content-type "application/json"
```

### 6.2 Test CloudFront Access

```bash
# Get CloudFront URL
DISTRIBUTION_URL="https://d1234567890.cloudfront.net"

# Test direct access
curl -I ${DISTRIBUTION_URL}/calendar.json

# Test CORS headers
curl -H "Origin: https://kaiukodukant.ee" \
     -I ${DISTRIBUTION_URL}/calendar.json
```

### 6.3 Validate Cache Headers

```bash
# Should see Cache-Control and CloudFront headers
curl -I ${DISTRIBUTION_URL}/calendar.json | grep -E "Cache-Control|X-Cache|Age"
```

---

## Step 7: Configuration Summary

Save these values for Apps Script configuration:

```javascript
// AWS Configuration for Apps Script
const AWS_CONFIG = {
  // IAM User Credentials
  accessKeyId: 'AKIA...',        // From Step 1.4
  secretAccessKey: 'wJalr...',    // From Step 1.4
  
  // S3 Configuration  
  region: 'eu-central-1',         // Your bucket region
  bucket: 'PILVIO_BUCKET_NAME',   // Your bucket name
  key: 'sites/kaiu-kodukant/calendar/calendar.json',
  
  // CloudFront (for frontend)
  distributionUrl: 'https://d1234567890.cloudfront.net',
  customDomain: 'https://calendar.kaiukodukant.ee' // if configured
};
```

---

## Step 8: Cost Optimization

### 8.1 S3 Lifecycle Rules

Create lifecycle rule to delete old calendar versions:

```json
{
  "Rules": [
    {
      "Id": "DeleteOldCalendarVersions",
      "Status": "Enabled",
      "Prefix": "sites/kaiu-kodukant/calendar/archive/",
      "Expiration": {
        "Days": 30
      }
    }
  ]
}
```

### 8.2 CloudFront Cost Controls

- Use "Price Class 100" (US, Canada, Europe only)
- Enable compression
- Set appropriate cache times
- Monitor usage with Cost Explorer

---

## Step 9: Troubleshooting

### Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| 403 Forbidden from S3 | Check bucket policy and IAM permissions |
| CORS errors | Verify CloudFront response headers policy |
| Cache not updating | Check Cache-Control headers and invalidation |
| High latency | Verify CloudFront distribution is active |
| Upload failures | Check IAM credentials and permissions |

### Debug Commands

```bash
# Check S3 object metadata
aws s3api head-object \
  --bucket PILVIO_BUCKET_NAME \
  --key sites/kaiu-kodukant/calendar/calendar.json

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION_ID \
  --paths "/calendar.json"

# Check CloudFront logs
aws s3 ls s3://PILVIO_BUCKET_NAME/cloudfront-logs/
```

---

## Step 10: Production Checklist

Before going live, ensure:

- [ ] IAM user created with minimal permissions
- [ ] S3 bucket structure created
- [ ] CloudFront distribution active
- [ ] OAC configured and bucket policy updated
- [ ] CORS headers working
- [ ] Custom domain configured (optional)
- [ ] SSL certificate valid
- [ ] Cache policies configured
- [ ] Monitoring alerts set up
- [ ] Test uploads working
- [ ] Frontend can fetch from CloudFront
- [ ] Fallback to Apps Script tested
- [ ] Documentation updated with actual values

---

## Appendix: Quick Setup Script

Save as `setup-kaiu-calendar.sh`:

```bash
#!/bin/bash

# Configuration
BUCKET_NAME="PILVIO_BUCKET_NAME"
AWS_REGION="eu-central-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create IAM user
aws iam create-user --user-name kaiu-calendar-sync

# Create and attach policy
cat > policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:PutObjectAcl"],
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/sites/kaiu-kodukant/calendar/*"
    }
  ]
}
EOF

aws iam put-user-policy \
  --user-name kaiu-calendar-sync \
  --policy-name KaiuCalendarS3Write \
  --policy-document file://policy.json

# Generate access keys
aws iam create-access-key --user-name kaiu-calendar-sync

# Create S3 structure
aws s3api put-object --bucket ${BUCKET_NAME} --key sites/kaiu-kodukant/calendar/

echo "Setup complete! Save the access keys shown above."
```

This completes the AWS infrastructure setup for the calendar S3 integration.