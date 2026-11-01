# EtherCAT + KickCAT 12 周学习计划

> 适用对象：具备 C++、CMake、Git 和基本以太网知识，希望从协议概念走到
> KickCAT 源码、仿真和真实硬件的开发者。
>
> 工作区源码快照：KickCAT `v2.6-rc3-12-gcb2e1a1`（`cb2e1a1`，2026-10-05）。
> 建议节奏：12 周，每周约 10 小时，总计约 120 小时；可按每周 8-12 小时
> 调整到约 96-144 小时。
>
> 如果你来自纯软件背景，并希望补齐 MCU、SPI/PDI、RTOS、实时和从站硬件视角，
> 请并行阅读
> [`ethercat-master-embedded-slave-foundations.md`](ethercat-master-embedded-slave-foundations.md)。

---

## 0. 学完后应该达到什么水平

完成本计划后，你应当能够：

1. 只借助十六进制帧，解释 EtherCAT Ethernet Header、EtherCAT Header、
   Datagram Header、寻址方式和 WKC。
2. 解释从站为什么能在转发帧的同时完成过程数据交换，以及 FMMU、
   SyncManager 和 ESC 各自负责什么。
3. 独立完成 KickCAT 主站的初始化、PDO 映射、周期性过程数据交换和基本诊断。
4. 读懂并修改 KickCAT 从站的 ESM、PDO、对象字典和邮箱处理链。
5. 在没有硬件时使用 `simulated_bus`、`network_simulator`、KickUI 和 ESI
   完成开发与故障注入。
6. 判断一个需求应该落在 `Frame`、`Link`、`Bus`、从站协议栈、设备应用还是
   工具层，而不是把所有逻辑堆进主循环。
7. 能说明当前版本支持什么、不支持什么，以及上线前还需要补哪些验证。

这不是一份“读完就结束”的资料清单。每周都必须留下代码、日志、抓包、笔记或
可运行测试中的至少一种证据。

---

## 1. 当前工作区里的学习资产

### 1.1 先用的可视化页面

| 页面 | 先看什么 | 对应源码 |
|---|---|---|
| [`index.html`](../index.html) | 协议分层、学习顺序、资料地图 | 项目总览 |
| [`frame.html`](../frame.html) | 帧头、PDU 头、命令矩阵、WKC 账本 | `KickCAT/lib/src/Frame.cc`、`protocol.h` |
| [`network.html`](../network.html) | 帧怎样穿过拓扑、FMMU 映射、时延预算 | `KickCAT/lib/master/src/Link.cc`、`Bus.cc` |
| [`esc.html`](../esc.html) | ESC 内存图、SM/FMMU、软件 ESC 对照 | `KickCAT/lib/slave/src/ESC/EmulatedESC.cc` |
| [`al.html`](../al.html) | ESM、邮箱、CoE/SDO/Emergency | `KickCAT/lib/src/Mailbox.cc`、`lib/src/CoE/` |
| [`slave.html`](../slave.html) | ESI、SII、从站实现路线、CTT | `KickCAT/lib/src/ESI/`、`lib/src/SIIParser.cc` |
| [`dc.html`](../dc.html) | 传播延时、偏移、漂移、SYNC0 | `KickCAT/lib/master/src/dc.cc` |
| [`guide.html`](../guide.html) | 可通读的协议手册 | `docs/guide.md` |
| [`glossary.html`](../glossary.html) | 中英术语与规范出处 | 遇到缩写时随查 |

### 1.2 KickCAT 自带文档

| 文档 | 用途 |
|---|---|
| [`../KickCAT/README.md`](../KickCAT/README.md) | 能力概览、构建、平台和文档入口 |
| [`../KickCAT/docs/FEATURES.md`](../KickCAT/docs/FEATURES.md) | 当前支持的权威功能矩阵 |
| [`../KickCAT/docs/architecture.md`](../KickCAT/docs/architecture.md) | 官方一页式类职责说明 |
| [`../KickCAT/docs/BUILDING.md`](../KickCAT/docs/BUILDING.md) | 构建、测试、Python 绑定 |
| [`../KickCAT/docs/SIMULATION.md`](../KickCAT/docs/SIMULATION.md) | 软件 ESC、网络仿真、JSON 配置 |
| [`../KickCAT/docs/TOOLS.md`](../KickCAT/docs/TOOLS.md) | KickUI、EEPROM 编辑器、CLI |
| [`../KickCAT/docs/HARDWARE.md`](../KickCAT/docs/HARDWARE.md) | K64F、XMC4800、NuttX 和部署 |
| [`../KickCAT/docs/PERFORMANCE.md`](../KickCAT/docs/PERFORMANCE.md) | RT-PREEMPT、调度、AF_XDP |

### 1.3 规范资料的使用边界

`etg_doc/` 中的 PDF 归 ETG 所有，仓库只保留本地索引和学习摘要，不应对外分发。
当前已解压的常用资料包括：

- `ETG1500_V1i0i2_D_R_MasterClasses.pdf`
- `ETG1510_V1i0i0_S_R_MasterDiagnosisInterface.pdf`
- `ETG1020_v1i6i0_S_R_ProtocolEnhancements.pdf`
- `ETG2200_V3i2i3_G_R_EtherCATImplementationGuide.pdf`
- `ESC_Overview.pdf`

`etg_doc.7z` 中可能还有更多规范。需要精读 ETG.1000.4/ETG.1000.6 时，优先使用
你已经合法取得的会员版本；没有原文时，先用站内交互页和 `docs/guide.md` 建立
概念，不要把缺少某份 PDF 当作暂停学习的理由。

---

## 2. 学习环境和资料准备

### 2.1 推荐环境

| 用途 | 推荐环境 | 说明 |
|---|---|---|
| 阅读可视化页面、写笔记 | Windows | 直接打开或运行 `.\start.ps1` |
| 构建、单测、仿真 | Ubuntu/Linux 或 WSL2 | KickCAT 主站的主要开发和实时环境是 Linux |
| 真实主站 | Linux + RT-PREEMPT | Windows 仅用于工具和测试，不适合硬实时 |
| 真实从站 | NuttX + LAN9252/XMC4800 | 需要对应板卡、调试器和 EEPROM 烧写 |

如果使用 WSL2，源码可直接从 `/mnt/d/...` 访问；长期构建建议把工作副本放到
WSL 的 ext4 文件系统，例如 `~/src/LearnEtherCAT`，避免跨文件系统构建过慢。

### 2.2 第 0 周的环境验收

在 Linux 中进入 KickCAT：

```bash
cd /path/to/LearnEtherCAT/KickCAT
./scripts/configure.sh build --with=unit_tests
./scripts/setup_build.sh build
cd build
make -j"$(nproc)"
ctest --output-on-failure
```

然后运行无需硬件的单从站环路：

```bash
cd /path/to/LearnEtherCAT/KickCAT
./build/examples/master/simulated_bus/simulated_bus \
  -f examples/slave/lan9252/freedom-k64f/nuttx/freedom-k64f.xml \
  -t Board
```

环境验收标准：

- `kickcat_unit` 构建成功，CTest 无失败。
- `simulated_bus` 输出检测到从站，并到达 `OPERATIONAL`。
- 能说清楚这次运行没有使用物理网卡。

若只需读代码和交互页面，可先完成环境验收的第 1 项，不必立刻准备硬件。

### 2.3 建议的记录方式

为每次实验保留一个小目录，命名如 `lab-w05-pdo/`，其中放：

1. `README.md`：目标、环境、运行命令、预期结果。
2. 运行日志或完整终端输出。
3. 关键代码差异或补丁。
4. 一张图：调用链、帧布局或状态迁移。
5. 一段“我仍然不确定什么”。

学习分支建议使用 `study/` 或 `codex/` 前缀，避免直接改 `master`。

---

## 3. 时间与学习方法

### 3.1 每周 10 小时的分配

| 活动 | 时间 | 目的 |
|---|---:|---|
| 交互页/规范/源码阅读 | 2.5 小时 | 建立概念和术语映射 |
| 调用链追踪与代码笔记 | 3 小时 | 把“文档说”变成“代码在哪里做” |
| 实验、编译、测试、调试 | 3.5 小时 | 获得可复现证据 |
| 复盘与输出 | 1 小时 | 用中文重写，暴露理解漏洞 |

比例不必机械执行，但**实验和输出合计不应低于每周 4 小时**。

### 3.2 每个实验固定问五个问题

1. 输入是什么：帧、寄存器、对象字典项还是应用缓冲区？
2. 谁拥有这块内存，生命周期有多长？
3. 成功路径和错误路径分别在哪里汇合？
4. WKC、AL Status、SDO abort 或邮箱状态中，哪一个是第一手判据？
5. 这个行为在仿真中成立，是否一定会在真实 ESC 上成立？

### 3.3 证据优先

不要用“我大概知道”作为验收。每个里程碑至少要能拿出：

- 一份带源码路径的调用链；
- 一次成功运行；
- 一次人为制造的失败；
- 一份对失败的定位过程；
- 一段给别人讲得清楚的总结。

---

## 4. 12 周路线总览

| 周 | 主题 | 主要来源 | 周产出 | 检查点 |
|---|---|---|---|---|
| 1 | 心智模型、帧与地址 | `index/frame/guide`、`protocol.h` | 手工帧图和 15 个术语 | 能解释“不是请求-响应” |
| 2 | Frame、Link、WKC | `frame/network`、`Frame.cc`、`Link.cc` | 命令/寻址判定树 | 能算出 WKC |
| 3 | ESC、FMMU/SM、ESM | `esc/al`、对应源码 | ESM 与寄存器对照表 | 能解释状态迁移条件 |
| 4 | 主站构建与初始化 | `master.html`、`Bus.cc` | 初始化时序图 + 单步日志 | **里程碑 1** |
| 5 | 过程映像、PDO、周期循环 | `network/esc`、`Bus::buildFrames` | iomap/FMMU/WKC 图 | 能修改一组 PDO |
| 6 | 邮箱、SDO、OD、ESI/SII | `al/slave`、CoE/ESI 源码 | 一次 SDO 的完整字节链 | 能定位邮箱超时 |
| 7 | KickCAT 从站协议栈 | `slave/SIMULATION`、`slave::Slave` | 从站组件装配图 | 能运行并观察从站 |
| 8 | 工具、诊断、冗余、故障注入 | `TOOLS`、KickUI、`EmulatedNetwork` | 故障矩阵和工具日志 | **里程碑 2** |
| 9 | 分布式时钟与实时性 | `dc`、`dc.cc`、`PERFORMANCE` | 时延/抖动预算 | 能区分 DC 与普通计时 |
| 10 | DS402 与设备应用 | DS402 源码、仿真电机 | 操作状态迁移记录 | 能控制仿真电机 |
| 11 | 真实硬件或等价集成 | `HARDWARE`、已有板卡 | Bring-up 报告 | 能完成端到端验证 |
| 12 | Capstone | 全部 | 可运行增量 + 测试 + 说明 | **里程碑 3** |

如果每周不能稳定投入 8 小时，可扩展到 16 周：把第 4、6、8、11 周各拆成两周。
不建议压缩到 8 周以内；EtherCAT 的难点通常不是 API，而是内存布局、时序和错误码。

---

## 5. 分周执行表

### 第 1 周：建立正确的心智模型

**目标**

- 用“一个帧沿环传播、从站就地读写共享内存”的模型替换“主站逐站询问”的模型。
- 分清 OSI 的物理层、数据链路层和应用层在 EtherCAT 中的边界。
- 认识 MainDevice/SubDevice 与主站/从站的对应关系。

**阅读**

- `index.html` 的协议分层与学习顺序。
- `frame.html` 的前三节引导。
- `docs/guide.md` 第 0-1 节。
- `KickCAT/lib/include/kickcat/protocol.h` 的 `EthernetHeader`、
  `EthercatHeader`、`DatagramHeader` 和 `Command`。

**实验**

1. 画一条 4 从站线型总线，标出帧进入和返回方向。
2. 任选一个 `LRW` 数据报，写出它的最小字节布局。
3. 用 1 个输出字节、2 个输入字节，计算单站命中时的 WKC。
4. 对照 `Frame::addDatagram()`，看 `multiple`、`irq`、`index` 分别何时写入。

**交付与验收**

- 一页 A4 帧结构图，至少包含 EtherType、EtherCAT Header、PDU Header、
  Data、WKC。
- 能用不超过 3 分钟解释：为什么 100 个从站不产生 100 次请求/响应往返。
- 能说明 `WKC` 是命中计数，不是从站数量，也不是数据正确性证明。

**复盘问题**

- 为什么周期通信主要用 `LRW`，而初始化常用 `APRD/APWR/BRD/BWR`？
- 为什么位置寻址的 ADP 在每一站递减，配置寻址和逻辑寻址又分别解决什么问题？

---

### 第 2 周：Frame、Link 与 WKC

**目标**

- 读懂帧构造、发送、接收、回调分发和错误状态。
- 知道 `Frame`、`AbstractLink`、`Link`、`AbstractSocket` 各自不该做什么。

**阅读**

- `KickCAT/lib/include/kickcat/Frame.h` 与 `lib/src/Frame.cc`。
- `KickCAT/lib/master/include/kickcat/AbstractLink.h`。
- `KickCAT/lib/master/include/kickcat/Link.h` 与 `lib/master/src/Link.cc`。
- `KickCAT/lib/include/kickcat/AbstractSocket.h`。
- 单元测试：`unit/src/frame-t.cc`、`unit/src/link-t.cc`、
  `unit/src/redundancy-t.cc`。

**实验**

1. 在 `Frame::addDatagram()` 处下断点，记录一次 `FPRD` 的完整缓冲区。
2. 人为把某个测试回调的 WKC 检查改成错误值，观察 `DatagramState` 和异常路径。
3. 找出一个“入队、分帧、发送、读回、分发、清理”的完整调用链。
4. 解释为什么 `Link` 要维护最多 255 个在途数据报，而一个 Ethernet 帧最多
   只容纳 15 个 EtherCAT PDU。

**交付与验收**

- 一页 `Frame -> Link -> Socket` 时序图。
- 一张表，列出 `LOST`、`SEND_ERROR`、`INVALID_WKC`、`NO_HANDLER`、`OK`
  的触发点。
- 能用代码路径解释异步 `addDatagram/processDatagrams` 和同步
  `writeThenRead` 的差异。

---

### 第 3 周：ESC、FMMU、SyncManager 与 ESM

**目标**

- 把“寄存器”与协议动作对应起来，而不是把 ESC 当成普通网卡。
- 理解 FMMU 的逻辑地址映射、SM 的缓冲/邮箱职责和 ESM 的状态门控。

**阅读**

- `esc.html` 的 ESC 内存图、FMMU、SM 和进站流水线。
- `al.html` 的 ESM 和 AL Control/Status 位。
- `KickCAT/lib/slave/include/kickcat/AbstractESC.h`。
- `KickCAT/lib/slave/include/kickcat/ESM.h`、
  `lib/slave/src/ESM.cc`、`lib/slave/src/ESMStates.cc`。
- `KickCAT/docs/FEATURES.md` 的状态机与过程数据矩阵。

**实验**

1. 列出 `INIT -> PRE_OP -> SAFE_OP -> OPERATIONAL` 每一步需要满足的条件。
2. 在源码中找出主站写入 `AL_CONTROL`、从站更新 `AL_STATUS` 的位置。
3. 画出一个从站的两个 FMMU 和两个 PDO SM，说明逻辑地址到物理地址的映射。
4. 人为让从站保持 `SAFE_OP`，记录 `OPERATIONAL` 请求超时的路径。

**交付与验收**

- 一张“状态 × 邮箱 × 输入 × 输出”表。
- 能说清 `SAFE_OP` 为什么允许输入有效而输出保持安全值。
- 能指出从站错误时 `AL_STATUS_CODE` 是在哪里写入的。

---

### 第 4 周：主站初始化与里程碑 1

**目标**

- 把 `Bus::init()` 的每一步与帧、寄存器、SII、邮箱对应起来。
- 完成一次可控的仿真主站启动。

**阅读**

- `master.html` 的 11 步启动时序。
- `KickCAT/examples/master/simulated_bus/simulated_bus.cc`。
- `KickCAT/lib/master/include/kickcat/Bus.h`。
- `KickCAT/lib/master/src/Bus.cc` 的 `init()`、`detectSlaves()`、
  `resetSlaves()`、`setAddresses()`、`fetchEeprom()`、
  `configureMailboxes()`。

**实验**

1. 在 `Bus::init()` 每个阶段后打印从站数量、地址、AL 状态和邮箱尺寸。
2. 记录广播读 `TYPE` 的 WKC，并与从站数量对照。
3. 记录站地址为什么从 `1001` 开始分配。
4. 让 SII 读取失败或超时，观察在哪一步得到可定位的错误。

**里程碑 1：能独立讲清启动**

交付一份带真实日志的初始化时序图，至少标出：

`BRD(TYPE)` → reset → `APWR(STATION_ADDR)` → `FPRD(ESC/DL)` →
`INIT` → SII → mailbox config → `PRE_OP`。

验收标准：

- 不查资料能解释每个阶段的目的。
- 能根据输出判断“没检测到从站”“PRE_OP 超时”“邮箱配置失败”分别发生在哪一层。
- 能指出 `Bus::init()` 结束时处于哪个状态，以及下一步为什么是映射而不是直接 OP。

---

### 第 5 周：过程映像、PDO 与周期循环

**目标**

- 理解 `iomap`、Slave 的 `input/output` 视图、EtherCAT 逻辑地址、FMMU、
  SyncManager 和实际 ESC RAM 之间的关系。
- 能安全地修改一对输入/输出 PDO 并观察结果。

**阅读**

- `network.html` 的 FMMU 覆盖和时延部分。
- `KickCAT/lib/master/src/Bus.cc` 的 `detectMapping()`、
  `assignLogicalAddresses()`、`mapProcessImage()`、`buildFrames()`、
  `sendLogicalRead()`、`sendLogicalWrite()`、`sendLogicalReadWrite()`。
- `KickCAT/lib/master/include/kickcat/Slave.h`。
- `KickCAT/lib/slave/include/kickcat/PDO.h` 与 `lib/slave/src/PDO.cc`。
- 单元测试：`bus-t.cc`、`slave/PDO-t.cc`。

**实验**

1. 在 `simulated_bus` 中把输出填充值从 `0x55` 改为自己的 4 字节模式。
2. 在仿真从站输入端生成一个递增序列，确认主站 `slave.input.data` 的更新时机。
3. 画出 `iomap` 中每个从站输入/输出块的偏移和大小。
4. 故意把 `iomap` 缓冲区缩小，确认边界检查在哪一层触发。

**交付与验收**

- 一张从应用缓冲区到 ESC 物理地址的六层映射图：
  `iomap -> Slave::PIMapping -> logical address -> frame offset ->
  FMMU -> SyncManager/ESC RAM`。
- 能说明 `LRD`、`LWR`、`LRW` 各自期望的 WKC 组成。
- 能解释为什么输出缓冲区必须在发帧前复制，输入缓冲区必须在回调中复制。
- 知道当前版本每个从站只支持一个输入 PDO SM 和一个输出 PDO SM。

---

### 第 6 周：邮箱、CoE、SDO、OD、ESI/SII

**目标**

- 理解配置期为什么需要邮箱，以及 SDO 如何访问对象字典。
- 分清 ESI（设计期 XML）、SII（EEPROM）、OD（固件运行期对象）的职责。

**阅读**

- `al.html` 的邮箱头、CoE 头和 SDO 快速/分段/CA 报文。
- `slave.html` 的 ESI/SII 结构。
- `KickCAT/lib/include/kickcat/Mailbox.h`。
- `KickCAT/lib/include/kickcat/CoE/protocol.h` 和 `CoE/OD.h`。
- `KickCAT/lib/src/ESI/Parser.cc`、`KickCAT/lib/src/ESI/SIIBuilder.cc`、
  `KickCAT/lib/src/SIIParser.cc`。
- `KickCAT/lib/master/src/Bus.cc` 的 `sendWriteMessages()`、
  `sendReadMessages()`，以及 `KickCAT/lib/master/src/CoE.cc` 的
  `readSDO()` / `writeSDO()` 调用链。

**实验**

1. 在仿真从站上读取标准标识对象 `0x1018`，记录 Index/SubIndex、传输类型、
   数据长度和返回值。
2. 人为请求不存在的对象索引，记录 SDO abort 或本地错误。
3. 对照 ESI XML、生成的 EEPROM 镜像和 `CoE::Dictionary`，找同一条对象在
   三处的表示。
4. 记录一次 SDO 前后的 mailbox `can_read`、`can_write`、counter 和 toggle。

**交付与验收**

- 一份 SDO 报文逐字节标注图。
- 一张邮箱握手时序图：检查可写 → 写请求 → 检查可读 → 读应答 → 释放缓冲。
- 能解释为什么 ESI、SII、固件 OD 不一致会导致“能上电但数据错位”。
- 能区分快捷传输、普通传输、分段传输和 Complete Access。

---

### 第 7 周：KickCAT 从站协议栈

**目标**

- 理解 `EmulatedESC + PDO + slave::Slave + response Mailbox + Dictionary`
  是如何装配成一个从站的。
- 能把 ESM、PDO、邮箱和应用绑定在运行时串起来。

**阅读**

- `KickCAT/docs/SIMULATION.md` 的 Emulator engine。
- `KickCAT/examples/master/simulated_bus/simulated_bus.cc` 的步骤 1-3。
- `KickCAT/lib/slave/include/kickcat/slave/Slave.h` 与
  `lib/slave/src/slave/Slave.cc`。
- `KickCAT/lib/slave/include/kickcat/ESMStates.h`。
- `KickCAT/lib/simulation/include/kickcat/simulation/SimulatedSlave.h`
  与 `KickCAT/lib/simulation/src/SimulatedSlave.cc`。
- 单元测试：`ESMState*-t.cc`、`slave/slave-t.cc`、`slave/PDO-t.cc`。

**实验**

1. 画 `slave::Slave::routine()` 的执行顺序。
2. 加一个 2 字节输入和 1 字节输出，验证对象字典条目与过程缓冲区别名关系。
3. 在一次状态迁移中打印当前状态、目标状态和 `AL_STATUS_CODE`。
4. 修改仿真从站的输入生成逻辑，确认变化只在下一轮主站读取后进入应用。

**交付与验收**

- 一张从站组件装配图，标明每块内存的所有者和生命周期。
- 能解释为什么 `setMailbox()` 要在启动前注入，以及 `PDO::configureMapping()`
  会把 OD 条目的 `data` 指向哪里。
- 能解释 `SAFE_OP` 时输入可更新、输出未验证时为什么不能进 OP。

---

### 第 8 周：仿真、工具、诊断、冗余与里程碑 2

**目标**

- 掌握无硬件开发闭环，能用工具观察而不是靠猜。
- 能制造链路、状态和邮箱故障，并知道第一手诊断信号。

**阅读**

- `KickCAT/docs/TOOLS.md`。
- `KickCAT/docs/SIMULATION.md` 的两种运行模式。
- `KickCAT/lib/slave/include/kickcat/EmulatedNetwork.h`。
- `KickCAT/simulation/network_simulator.cc`。
- `KickCAT/lib/master/src/Diagnostics.cc`。
- `KickCAT/tools/scan_topology.cc`。

**实验**

1. 运行两进程仿真：

   ```bash
   # Terminal 1
   ./build/simulation/network_simulator -i tap:server \
     -s simulation/slave_configs/freedom-k64f.json \
        simulation/slave_configs/xmc4800.json

   # Terminal 2
   ./build/examples/master/easycat/easycat_example -i tap:client
   ```

2. 用同一总线运行 `scan_topology -i "?"`；如果它列出的是真实接口而非 TAP，
   不要误以为仿真故障就是物理链路故障。
3. 如果构建了 KickUI，用它的拓扑、SDO/PDO 和事件面板检查总线。
4. 在 `EmulatedNetwork` 支持的范围内断开/恢复一段链路，记录 DL Status、
   WKC 和冗余激活路径。

**里程碑 2：能完成一次故障实验**

故障报告必须包含：

- 故障如何注入；
- 第一个异常信号；
- 主站、Link、从站分别看到什么；
- 错误如何恢复，或为什么无法恢复；
- 这与真实硬件可能有哪些差异。

---

### 第 9 周：分布式时钟与实时性

**目标**

- 区分“帧按时到达”“系统时间一致”“SYNC0 触发输出”三个层次。
- 识别主站抖动、从站时钟漂移和周期设计之间的关系。

**阅读**

- `dc.html`。
- `KickCAT/lib/master/include/kickcat/Bus.h` 的 DC API。
- `KickCAT/lib/master/src/dc.cc`。
- `KickCAT/lib/include/kickcat/OS/SoftPll.h` 与
  `lib/src/OS/SoftPll.cc`。
- `KickCAT/docs/PERFORMANCE.md`。
- `KickCAT/docs/FEATURES.md` 的 DC 支持矩阵。

**实验**

1. 运行 `simulated_bus --dc`，记录同步结果。
2. 注入不同的仿真时钟漂移，观察 `0x092C` 和同步判定。
3. 用 `Timer` 记录几百个周期的实际间隔，画最大、最小、P99 抖动。
4. 计算一个 128 字节帧、10 个从站、每站 300 ns 的大致传播时间预算，并
   与主站软件开销分开。

**交付与验收**

- 一张 DC 初始化步骤图。
- 一张“周期时间、帧时间、从站转发、应用执行”预算表。
- 能解释为什么不能把主站软件采样时间直接乱写回参考从站。
- 明确当前版本的限制：主站 DC 为实验性，真实从站侧 DC 尚未实现。

---

### 第 10 周：DS402 与设备应用

**目标**

- 把 PDO 字节、对象字典和 CiA 402 状态机联系起来。
- 能在仿真电机上按安全顺序使能、设定值和关闭。

**阅读**

- `KickCAT/lib/master/include/kickcat/CoE/CiA/DS402/Drive.h`。
- `KickCAT/lib/include/kickcat/CoE/CiA/DS402/StateMachine.h`。
- `KickCAT/examples/master/ds402_drive/ds402_sinus.cc`。
- `KickCAT/examples/master/ingenia/`、`elmo/` 中的厂商差异。
- 仿真配置：`simulation/slave_configs/ecat402-drive.json`。

**实验**

1. 用仿真电机启动总线，记录 `Statusword`、`Controlword` 和模式字段。
2. 按禁用、准备、使能、运行、故障复位的顺序做状态迁移。
3. 先设置目标位置等于实际位置，再使能，避免仿真“跳到 0”。
4. 在仿真中制造一个异常状态，观察驱动状态机和总线错误的区别。

**交付与验收**

- 一张 CiA 402 状态迁移表，标出关键控制位和状态位。
- 能说明“PDO 映射成功”“驱动器使能”“运动指令生效”不是同一件事。
- 能指出 PDO 字段的字节顺序、对齐和厂商映射差异。

---

### 第 11 周：真实硬件或等价集成

**目标**

- 把仿真中得到的行为放到真实链路中验证。
- 建立可重复的部署、诊断和回滚流程。

**有硬件的路线**

1. 选择一种受支持组合：Freedom K64F + LAN9252、Arduino Due + LAN9252 或
   XMC4800 Relax Kit。
2. 按 `KickCAT/docs/HARDWARE.md` 构建 NuttX 固件、烧写板卡、写 EEPROM。
3. 在 Linux 主站上先运行 `scan_topology`，再运行最小主站示例。
4. 完成 INIT → PRE_OP → SAFE_OP → OP，记录 AL 状态和错误计数。
5. 拔插/断开一次链路，记录诊断信号并恢复。
6. 使用 `ethtool`、`chrt` 或 RT-PREEMPT 环境做基础实时性检查。

**无硬件的替代路线**

1. 用两进程仿真完成同样的状态、SDO/PDO、断链和恢复实验。
2. 为 `EmulatedNetwork` 增加一个不改变协议行为的诊断用例。
3. 写一份“换到真实硬件时必须补测的 10 项清单”，逐项说明原因。

**交付与验收**

- 一页 Bring-up 报告：硬件、接线、固件、接口、RT 内核、运行命令、
  结果、错误和恢复过程。
- 对比仿真与真实硬件的行为差异，特别关注时序、时钟和链路错误。

---

### 第 12 周：Capstone 与复盘

从下面选一个，不要同时做多个：

1. **最小自定义从站（推荐）**：建立一个 2 字节输入、2 字节输出、至少一个
   SDO 对象、一条 CoE 邮箱链路的仿真从站。
2. **诊断工具**：基于 `Bus` 写一个 CLI，周期性输出拓扑、AL 状态、WKC 和
   错误计数变化，并给出明确的退出码。
3. **故障注入测试**：围绕隐藏链路、冗余激活和恢复建立自动化测试。
4. **DS402 演示**：用仿真电机完成一组带限幅、故障处理和记录的轨迹。

推荐验收清单：

- 有明确的需求边界和“不支持项”。
- 至少一个单元测试或可重复集成测试。
- 只改必要的层，不把协议逻辑塞进工具层。
- 能展示一次成功和一次预期失败。
- 有帧/状态/配置的可视化说明。
- 不在 `master` 上留未整理的实验代码。

最终复盘回答：

1. 哪个设计决定最能说明 KickCAT 是“薄协议栈”？
2. 如果增加多 PDO SM，你会改哪些层？
3. 如果换一个 ESC，硬件抽象边界是否足够？
4. 哪些行为只有真实硬件和 CTT 才能验证？
5. 下一阶段最值得补的是功能、测试还是实时性？

---

## 6. 每周固定复述题

每周结束前，不看资料回答：

1. 本周涉及的最小数据单元是什么？字节序、位宽和边界在哪里？
2. 哪个对象拥有内存，谁只持有指针？
3. 成功路径上 WKC/状态/标志位何时更新？
4. 错误路径是回调、异常、超时还是状态机拒绝？
5. 仿真和真实硬件在这一行为上可能差在哪里？

如果答不出来，不要开新主题；回到源码补一条调用链即可。

---

## 7. 常见故障的定位顺序

| 现象 | 第一检查 | 第二检查 | 对应代码 |
|---|---|---|---|
| `No slave detected` | 网卡、接线、权限、接口名 | `BRD(TYPE)` 的 WKC | `Bus::detectSlaves()` |
| PRE_OP 超时 | SII 是否读到、邮箱配置是否成功 | `AL_STATUS_CODE` | `fetchEeprom()`、`configureMailboxes()` |
| `INVALID_WKC` | 逻辑地址、FMMU、SM、帧内偏移 | 期望贡献与实际贡献 | `buildFrames()`、`sendLogical*` |
| SAFE_OP 到 OP 超时 | 输出是否有效、看门狗 | 从站 AL 错误码 | `validateOutputData()`、ESM OP 状态 |
| SDO 超时 | 邮箱可读/可写状态 | counter/toggle、对象是否存在 | `Mailbox`、`sendMessages()` |
| 输入数据错位 | ESI/SII/OD 是否一致 | 位宽、对齐、SM 长度 | `PDO::configureMapping()` |
| DC 无法同步 | 参考时钟、传播延时、SYNC0 | 当前功能是否只仿真支持 | `dc.cc`、`EmulatedESC` |
| 仿真正常、硬件失败 | 时序、PHY、EEPROM、PDU 争用 | 真实 ESC 限制 | `HARDWARE.md`、ESC 数据手册 |

先判定问题位于“没检测到”“状态迁移失败”“WKC 错误”“邮箱超时”“应用数据错误”
中的哪一类，再决定看哪层代码。不要一上来就改 `Link`。

---

## 8. 当前版本必须记住的限制

- 每个从站当前支持一个输入 PDO SyncManager 和一个输出 PDO SyncManager。
- 主站 DC 为实验性功能；真实从站侧 DC 尚未实现。
- FoE 在主站和从站均为实验性；EoE 仍是计划项。
- Windows 可用于工具和测试，但不适合硬实时主站。
- 代码当前按小端主机设计。
- 仿真没有中断模拟；真实硬件的中断、PHY 和 EEPROM 行为必须另测。
- `Bus::createMapping()` 负责映射和 FMMU 配置；示例仍显式请求
  `SAFE_OP`，不要仅凭头文件注释假设它会自动迁移状态。

这些限制不是“建议忽略的 TODO”，而是设计实验和验收时必须写进假设的前置条件。

---

## 9. 学习计划进度表

| 周 | 文档已读 | 源码已追踪 | 实验完成 | 交付物 | 复盘完成 |
|---|---|---|---|---|---|
| 1 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 2 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 3 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 4 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 5 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 6 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 7 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 8 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 9 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 10 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 11 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 12 | [ ] | [ ] | [ ] | [ ] | [ ] |

---

## 10. 推荐的精读顺序

| 顺序 | 阅读内容 | 目的 |
|---:|---|---|
| 1 | `docs/guide.md` 第 0-2 节 | 建立主心智模型 |
| 2 | `frame.html` + `network.html` | 帧、寻址、WKC、拓扑 |
| 3 | `KickCAT/docs/FEATURES.md` | 明确当前能力边界 |
| 4 | `KickCAT/docs/architecture.md` | 认识类职责 |
| 5 | `KickCAT/docs/BUILDING.md` + 实际构建 | 建立开发循环 |
| 6 | `KickCAT/examples/master/simulated_bus` | 走通一条最小全链路 |
| 7 | `Bus.h` + `Bus.cc` | 主站核心 |
| 8 | `Frame/AbstractLink/Link` | 数据面与错误处理 |
| 9 | `Mailbox` + `CoE/OD` | 配置面 |
| 10 | `slave::Slave` + `PDO` + ESM | 从站实现 |
| 11 | `EmulatedESC` + `EmulatedNetwork` | 仿真与物理模型 |
| 12 | `HARDWARE.md` + `PERFORMANCE.md` | 工程化与实时性 |

更完整的类职责和调用链请看
[`kickcat-framework.md`](kickcat-framework.md)。需要把主站字节、ESC/PDI、
从站状态机和真实硬件故障串成一条因果链时，继续阅读
[`ethercat-master-embedded-slave-foundations.md`](ethercat-master-embedded-slave-foundations.md)。

---

## 11. 参考与版权提示

- [ETG 官方下载入口](https://www.ethercat.org/en/downloads.html)
- [ETG.1500 Master Classes](https://www.ethercat.org/en/downloads/downloads_E8DE229AAF2C452D937F02791437F4B4.htm)
- [ETG.2200 SubDevice Implementation Guide](https://www.ethercat.org/cn/downloads/downloads_7BA2567EB9F443219AD0014448F674F2.htm)
- 规范原文的版权归 ETG 所有；本地 `etg_doc/` 只用于学习索引，不作为可再分发资料。
- 代码实现以当前工作区源码为准；升级 KickCAT 后应重新核对
  `FEATURES.md` 和调用链。
