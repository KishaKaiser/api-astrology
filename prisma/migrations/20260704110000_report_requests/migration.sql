CREATE TABLE IF NOT EXISTS `ReportRequest` (
  `id` VARCHAR(191) NOT NULL,
  `reportId` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NULL,
  `productName` VARCHAR(191) NULL,
  `formData` JSON NOT NULL,
  `reportText` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `ReportRequest_reportId_key`(`reportId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
