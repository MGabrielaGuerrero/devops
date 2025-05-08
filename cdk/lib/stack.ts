import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';

export class Stack extends cdk.Stack {
  readonly vpc: ec2.Vpc;
  readonly dbInstance: rds.DatabaseInstance;
  readonly dbSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC con subredes públicas y privadas
    this.vpc = new ec2.Vpc(this, 'MyVPC', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    // Secreto con credenciales de PostgreSQL
    this.dbSecret = new secretsmanager.Secret(this, 'DBCredentialsSecret', {
      secretName: 'lab-db-credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'myusername' }),
        generateStringKey: 'password',
        excludePunctuation: true,
      },
    });

    // Grupo de seguridad para RDS
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'PostgresSG', {
      vpc: this.vpc,
      description: 'Permitir acceso al backend desde ECS',
      allowAllOutbound: true,
    });

    // Instancia RDS PostgreSQL
    this.dbInstance = new rds.DatabaseInstance(this, 'PostgresDB', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_15 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [dbSecurityGroup],
      credentials: rds.Credentials.fromSecret(this.dbSecret),
      databaseName: 'test_local',
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      multiAz: false,
      publiclyAccessible: false,
      backupRetention: cdk.Duration.days(0),
      deleteAutomatedBackups: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
    });


    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: this.vpc,
      containerInsights: true,
    });

    // Log group
    const logGroup = new logs.LogGroup(this, 'BackendLogGroup', {
      logGroupName: '/ecs/-backend',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Construir imagen local desde test-api/
    const backendImage = new ecrAssets.DockerImageAsset(this, 'BackendImage', {
      directory: '../test-api',
    });

    // SG para ECS backend
    const backendSG = new ec2.SecurityGroup(this, 'BackendSG', {
      vpc: this.vpc,
      description: 'Permitir acceso a internet y RDS',
      allowAllOutbound: true,
    });

    // Permitir ECS acceder al RDS
    this.dbInstance.connections.allowFrom(backendSG, ec2.Port.tcp(5432));

    // Definir tarea Fargate
    const taskDef = new ecs.FargateTaskDefinition(this, 'BackendTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    // Variables de entorno
    taskDef.addContainer('BackendContainer', {
      image: ecs.ContainerImage.fromDockerImageAsset(backendImage),
      containerName: 'backend',
      logging: ecs.LogDriver.awsLogs({
        logGroup,
        streamPrefix: 'backend',
      }),
      portMappings: [{ containerPort: 4000 }],
      environment: {
        SEQ_USER: 'myusername',
        SEQ_DB: 'test-local',
        SEQ_PORT: '5432',
        SEQ_HOST: this.dbInstance.dbInstanceEndpointAddress,
      },
      secrets: {
        SEQ_PW: ecs.Secret.fromSecretsManager(this.dbSecret, 'password'),
      },
    });

    // Servicio Fargate para backend
    const backendService = new ecs.FargateService(this, 'BackendService', {
      cluster,
      taskDefinition: taskDef,
      assignPublicIp: false,
      securityGroups: [backendSG],
      desiredCount: 1,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    const scaling = backendService.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 3,
    });
    
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 60,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });
    
    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 75,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });
    

    // SG para el ALB
    const albSG = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc: this.vpc,
      description: 'Permitir trafico HTTP',
      allowAllOutbound: true,
    });
    albSG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Permitir HTTP publico');

    // Crear el ALB público
    const alb = new elbv2.ApplicationLoadBalancer(this, 'BackendALB', {
      vpc: this.vpc,
      internetFacing: true,
      loadBalancerName: 'BackendALB',
      securityGroup: albSG,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    // Listener en el puerto 80
    const listener = alb.addListener('ListenerHTTP', {
      port: 80,
      open: true,
    });

    // Asociar el backend ECS como destino del ALB
    listener.addTargets('BackendTarget', {
      port: 4000,
      targets: [backendService],
      protocol: elbv2.ApplicationProtocol.HTTP,
      healthCheck: {
        path: '/',
        interval: cdk.Duration.seconds(30),
      },
    });
    
  }
}

