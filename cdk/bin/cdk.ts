#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { Stack } from '../lib/stack';

const app = new cdk.App();

new Stack(app, 'appStack', {
  env: {
    region: 'us-east-1'  // Cambia a tu región si usas otra
  }
});
