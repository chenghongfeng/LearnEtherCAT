# KickCAT 项目框架说明

> 源码版本：`v2.6-rc3-12-gcb2e1a1`（commit `cb2e1a1`，2026-10-05）
>
> 本文以当前工作区的 `KickCAT/` 源码为事实依据，重点说明模块边界、调用链、
> 内存所有权、仿真路径和扩展点。功能是否有正式支持，以
> [`KickCAT/docs/FEATURES.md`](../KickCAT/docs/FEATURES.md) 为准。

---

## 1. 项目定位

KickCAT 是一个面向嵌入式和实时系统的轻量 EtherCAT 协议栈。它的核心特点不是
“提供一个完整 PLC”，而是：

1. 同一代码库同时包含 **Master（MainDevice）** 和 **Slave（SubDevice）**。
2. 核心协议层尽量薄，不替用户决定应用调度、运动控制或数据模型。
3. 用 `AbstractLink`、`AbstractSocket`、`AbstractESC` 隔离传输、OS 和 ESC。
4. 自带软件 ESC 与网络仿真，能在没有硬件时走通主站和从站全链路。
5. 附带 KickUI、EEPROM 编辑器、CLI、Python 绑定和测试，覆盖开发闭环。

当前主站运行在 Linux、PikeOS 和 Windows；其中 Windows 定位为工具和测试，
不适合硬实时。从站协议栈运行在 NuttX，当前支持 LAN9252（SPI）和
XMC4800（集成 ESC）。

---

## 2. 一张总架构图

```text
┌─────────────────────────────────────────────────────────────────────┐
│ 应用层：用户循环 / Python / KickUI / CLI / DS402 应用               │
└───────────────┬─────────────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────────────┐
│ 主站控制面                                                          │
│ Bus：枚举、ESM、PDO 映射、SII、邮箱调度、诊断、DC                   │
│ Slave（主站侧元数据）：地址、SII、AL/DL 状态、输入/输出视图          │
│ Mailbox/CoE/OD/FoE/DS402/Gateway                                   │
└───────────────┬─────────────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────────────┐
│ 链路与数据面                                                        │
│ AbstractLink / Link：分帧、在途数据报、回调、超时、冗余、IRQ         │
│ Frame：Ethernet + EtherCAT Header + PDU + WKC                       │
│ AbstractSocket：raw socket / AF_XDP / Npcap / Loopback / TAP         │
└───────────────┬─────────────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────────────┐
│ 从站协议栈与 ESC                                                    │
│ AbstractESC                                                        │
│ ├─ 真实硬件：LAN9252、XMC4800                                       │
│ └─ 软件模型：EmulatedESC（寄存器、SM、FMMU、EEPROM、DC）             │
│ slave::Slave：ESM、PDO、邮箱处理                                    │
│ EmulatedNetwork：物理拓扑、端口路由、断链/恢复、冗余注入             │
└─────────────────────────────────────────────────────────────────────┘
```

这里有两个容易混淆的 `Slave`：

- `kickcat::Slave`：主站侧对网络上某个从站的**描述对象**。
- `kickcat::slave::Slave`：真正运行在从站侧的**协议栈状态机对象**。

前者主要由 `Bus` 拥有；后者由从站应用或仿真器装配。

---

## 3. 代码目录地图

```text
KickCAT/
├── CMakeLists.txt                  # 顶层构建选项和子目录
├── README.md                       # 项目入口
├── docs/                           # 架构、构建、硬件、仿真、工具、性能
├── lib/
│   ├── include/kickcat/            # 核心公共头文件
│   ├── src/                        # Frame、Mailbox、SII、CoE、FoE、OS 等
│   ├── master/                     # 主站 Bus、Link、Slave、DC、DS402
│   ├── slave/                      # 从站 ESM、PDO、Slave、ESC 驱动
│   ├── simulation/                 # SimulatedSlave、网络拓扑、控制服务
│   └── py_bindings/                # 底层 Python 绑定实现
├── examples/
│   ├── master/                     # simulated_bus、easycat、DS402、网关等
│   └── slave/                      # XMC4800、LAN9252、NuttX 板级示例
├── simulation/                     # network_simulator 和 JSON 从站配置
├── tools/                          # CLI、KickUI、EEPROM 编辑器、Python GUI
├── unit/                           # 单元测试
├── test/integration/               # 集成测试与硬件测试辅助
├── py_bindings/                    # Python 包/示例入口
├── conan/                          # 依赖配置
├── scripts/                        # 配置、构建、部署封装
└── vendor/                         # 第三方 GUI 依赖
```

最重要的源码入口：

| 关注点 | 入口 |
|---|---|
| 帧与协议常量 | `lib/include/kickcat/protocol.h` |
| 帧构造/解析 | `lib/include/kickcat/Frame.h`、`lib/src/Frame.cc` |
| 主站链路 | `lib/master/include/kickcat/Link.h`、`lib/master/src/Link.cc` |
| 主站核心 | `lib/master/include/kickcat/Bus.h`、`lib/master/src/Bus.cc` |
| 主站侧从站模型 | `lib/master/include/kickcat/Slave.h` |
| 主站邮箱 | `lib/include/kickcat/Mailbox.h`、`lib/src/Mailbox.cc` |
| CoE/对象字典 | `lib/include/kickcat/CoE/`、`lib/src/CoE/` |
| 从站协议栈 | `lib/slave/include/kickcat/slave/Slave.h` |
| 从站状态机 | `lib/slave/include/kickcat/ESM.h`、`lib/slave/src/ESM*.cc` |
| 软件 ESC | `lib/slave/include/kickcat/ESC/EmulatedESC.h` |
| 仿真拓扑 | `lib/slave/include/kickcat/EmulatedNetwork.h` |
| 仿真从站装配 | `lib/simulation/include/kickcat/simulation/SimulatedSlave.h` |
| 最小全链路示例 | `examples/master/simulated_bus/simulated_bus.cc` |

---

## 4. 构建系统与组件边界

### 4.1 一个核心库，按源文件组合能力

`lib/CMakeLists.txt` 创建 `kickcat` 库，核心源文件包括：

- `Frame.cc`、`Mailbox.cc`、`protocol.cc`
- `SIIParser.cc`
- CoE、FoE 邮箱与协议
- OS 抽象后端

随后：

- `lib/master/CMakeLists.txt` 把 `Bus.cc`、`Link.cc`、`dc.cc`、`CoE.cc`、
  `Diagnostics.cc`、`DS402/Drive.cc` 等加入同一个 `kickcat` 目标。
- `lib/slave/CMakeLists.txt` 把 `EmulatedESC.cc`、`Lan9252.cc`、
  `XMC4800.cc`、`ESM.cc`、`PDO.cc`、`slave/Slave.cc` 等加入同一目标。

因此使用方链接 `kickcat` 时会得到当前构建配置下启用的主站和从站代码。

### 4.2 独立仿真库

`kickcat_simulation` 是单独目标，包含：

- `SimulatedSlave.cc`
- `Topology.cc`
- `DeviceApp.cc`
- `DirectoryStorage.cc`
- `SimulatorControlServer.cc`

它依赖 `kickcat` 和 `nlohmann_json`，用于主机侧仿真、KickUI 和测试。

### 4.3 主要 CMake 选项

| 选项 | 默认 | 作用 |
|---|---|---|
| `BUILD_MASTER_EXAMPLES` | 主机为 ON | 构建主站示例 |
| `BUILD_SLAVE_EXAMPLES` | ON | 构建从站板级示例 |
| `BUILD_UNIT_TESTS` | OFF | 单元测试 |
| `BUILD_SIMULATION` | 主机为 ON | 网络仿真器 |
| `BUILD_TOOLS` | 主机为 ON | CLI 工具 |
| `ENABLE_ESI_PARSER` | 主机为 ON | ESI XML 解析与 SII 生成 |
| `ENABLE_AF_XDP` | OFF | Linux AF_XDP 高性能后端 |
| `BUILD_KICKUI` | OFF | ImGui 总站 GUI |
| `BUILD_EEPROM_EDITOR` | OFF | EEPROM/SII 编辑器 |

标准开发构建：

```bash
cd KickCAT
./scripts/configure.sh build --with=unit_tests
./scripts/setup_build.sh build
cd build
make -j"$(nproc)"
ctest --output-on-failure
```

`scripts/configure.sh` 将选项写入 `.buildconfig`，`setup_build.sh` 负责
Conan 依赖和 CMake 配置。除非 CMake 或依赖变化，后续通常只需重新构建。

### 4.4 C++ 与平台基线

- C++17，无编译器扩展。
- 当前实现按小端主机设计。
- Linux、Windows、NuttX、PikeOS 各有 OS 后端。
- `Frame` 直接在打包缓冲区上读写，部分多字节字段可能未对齐；顶层构建的
  UBSAN 配置刻意关闭 `alignment` 检查。

---

## 5. 主站分层与调用链

### 5.1 分层职责

| 层 | 主要类型 | 职责 | 不负责 |
|---|---|---|---|
| 应用 | `main()`、业务循环 | 读输入、算控制、写输出、调度周期 | 帧编码、FMMU 配置 |
| 总线控制 | `Bus` | 枚举、ESM、映射、邮箱、诊断、DC | 直接系统调用收发网卡 |
| 从站元数据 | `kickcat::Slave` | 地址、SII、状态、PDO 视图、邮箱队列 | 从站协议栈执行 |
| 链路 | `AbstractLink` / `Link` | 数据报入队、分帧、收发、回调、冗余、超时 | 业务对象解析 |
| 帧 | `Frame` | Ethernet/EtherCAT/PDU/WKC 编码与访问 | 网络 I/O |
| 传输 | `AbstractSocket` | 原始帧读写 | EtherCAT 业务语义 |

`Frame` 是纯粹的协议缓冲区抽象。它会在 `addDatagram()` 中写命令、地址、长度、
标志和数据，但不会替调用者检查帧容量或业务上的 WKC 期望值。容量和生命周期
由上层 `Link`、`Bus` 和调用者共同保证。

### 5.2 典型主站装配

```cpp
auto [nominal, redundancy] = createSockets(interface, redundancy_interface);
auto link = std::make_shared<kickcat::Link>(
    nominal, redundancy, []() { /* redundancy activated */ });
link->setTimeout(2ms);

kickcat::Bus bus(link);
bus.init(100ms);

std::vector<uint8_t> iomap(4096);
bus.createMapping(iomap.data(), iomap.size());

bus.requestState(kickcat::State::SAFE_OP);
bus.waitForState(kickcat::State::SAFE_OP, 1s);

// 将有效输出写入 slave.output.data，然后至少运行一次周期交换。
bus.requestState(kickcat::State::OPERATIONAL);
bus.waitForState(kickcat::State::OPERATIONAL, 1s, cyclic_exchange);
```

这是结构示意，不是完整可编译程序；实际错误处理和周期循环见
`examples/master/easycat/easycat_example.cc`。

### 5.3 `Bus::init()` 做了什么

当前源码中的主路径如下：

1. `detectSlaves()`
   - 用 `BRD` 读 ESC `TYPE` 寄存器。
   - 因为每个从站命中一次，返回值 WKC 作为检测到的从站数。
   - 按该数量创建 `std::vector<kickcat::Slave>`。
2. `resetSlaves(watchdog)`
   - 广播复位 FMMU、SM、DC 控制、事件掩码、错误计数和看门狗。
   - 设置 PDI/PDO 看门狗。
3. `setAddresses()`
   - 用自动增量物理写 `APWR` 设置配置站地址。
   - 当前地址从 `1001` 依次分配。
4. `fetchESC()` / `fetchDL()`
   - 读取每个从站的 ESC 描述和 DL Status。
5. `requestState(INIT)` + `waitForState(INIT, ...)`
6. `fetchEeprom()`
   - 通过 EEPROM 寄存器接口读取 SII。
   - 解析为厂商、产品、邮箱、SM、PDO 等元数据。
7. `configureMailboxes()`
   - 根据 SII 为有邮箱的从站配置 SM0/SM1。
8. `requestState(PRE_OP)` + `waitForState(PRE_OP, ...)`
9. 清理邮箱并挂接 Emergency/Check 消息处理器。

`init()` 结束时总线处于 **PRE_OP**，不是 OP。

### 5.4 `createMapping()` 做了什么

`Bus::createMapping(iomap, size)` 的顺序：

1. `detectMapping()`
   - 对支持 CoE 的从站，通过 SDO 读取 `0x1C00`（SM 通信类型）和
     `0x1C10 + N`（PDO 分配），计算每个方向的 PDO 位数。
   - 对不支持 CoE 的从站，使用 SII 中的 PDO 类别计算大小。
   - 当前每站只选择一个输入 SM 和一个输出 SM。
2. `assignLogicalAddresses()`
   - 为每个从站的输入和输出分配逻辑地址。
   - 输入与输出在逻辑地址空间中可重叠，以提高帧密度。
3. `mapProcessImage()`
   - 先给所有输入块分配 `iomap` 空间，再给输出块分配。
   - 把 `Slave::PIMapping::data` 指向 `iomap`。
   - 调用 `buildFrames()` 构造一个或多个周期 `PIFrame`。
4. `configureFMMUs()`
   - 对每个 PDO 方向配置 SyncManager 和 FMMU。
   - 当前 FMMU0 用于输出，FMMU1 用于输入。
5. 可选的邮箱状态 FMMU
   - 启用 `configureMailboxStatusCheck()` 时，把邮箱状态位也映射到周期帧。

注意：头文件旧注释仍可能写着“创建映射后进入 SAFE_OP”，但当前实现不主动请求
状态；示例在 `createMapping()` 后显式调用 `requestState(SAFE_OP)`。

### 5.5 `iomap`、Slave 视图与帧的关系

```text
用户 iomap
  ├─ 输入区：所有 Slave.input 块连续存放
  └─ 输出区：所有 Slave.output 块连续存放
          │
          ▼
Slave::PIMapping::data 指向 iomap 中的块
          │
          ▼
PIFrame.inputs/outputs 保存“iomap 指针 + 帧内偏移 + 大小 + 所属从站”
          │
          ▼
LRD/LWR/LRW 数据区
          │
          ▼
逻辑地址由 FMMU 映射到 ESC 的内部 RAM / SM 缓冲区
```

建立映射后，`iomap` 必须比 `Bus` 活得更久。移动、释放或重新分配该缓冲区都会
使 `Slave.input.data` / `Slave.output.data` 悬空。

### 5.6 周期数据路径

同步写法：

- `processDataRead()`：发 `LRD`，回调把帧数据复制回 `iomap`。
- `processDataWrite()`：先把 `iomap` 输出复制到帧缓冲，再发 `LWR`。
- `processDataReadWrite()`：把输出复制到帧，发一个 `LRW`，再从响应复制输入。

异步写法：

```cpp
bus.sendLogicalRead(error);
bus.sendLogicalWrite(error);
bus.sendRefreshErrorCounters(error);
sequencer.step(error);
bus.finalizeDatagrams();
bus.processAwaitingFrames();
```

每一步只是把数据报加入 `Link` 的队列或处理已有响应；真正的网络发送/读取发生在
`finalizeDatagrams()` 和 `processAwaitingFrames()`。

WKC 检查的中心逻辑：

- `LRD`：期望命中所有输入映射，以及由邮箱状态 FMMU 额外贡献的读命中。
- `LWR`：期望每个输出映射被写命中。
- `LRW`：期望每个从站的读/写贡献总和，包括可选的邮箱状态贡献。
- 即使 WKC 错误，输入复制可能已经发生；错误回调负责让应用决定是否使用该周期。

### 5.7 主站邮箱链

主站侧每个 `kickcat::Slave` 都持有一个 `mailbox::request::Mailbox`：

- `to_send`：等待发送的消息。
- `to_process`：已发送、等待应答或持续监听的消息。
- `can_read` / `can_write`：由 SM 状态位或周期帧中的状态位更新。
- `counter`：3 bit 邮箱会话计数，取值 1-7。

`MailboxSequencer` 每轮只推进一步，循环顺序为：

1. 检查从站发送邮箱是否可读。
2. 读取可用应答。
3. 检查从站接收邮箱是否可写。
4. 写入排队请求。

读优先于写，可以尽快释放从站出邮箱。这样避免每个周期同时打满四类邮箱数据报。

---

## 6. Link、Socket 与冗余

### 6.1 `AbstractLink` 的两种接口风格

- 同步：`writeThenRead(Frame&)`，发送帧并等待响应。
- 异步：`addDatagram(...)` 入队，最后由 `processDatagrams()` 批量发送和分发回调。

回调有两个：

- `process(header, data, wkc)`：处理正常收到的数据报，返回最终
  `DatagramState`。
- `error(state)`：处理丢失、发送失败、WKC 错误或没有处理器的情况。

`Link` 通过 8 位 `DatagramHeader::index` 将响应映射回原回调，所以可以连续发送
多个帧而不必按响应顺序阻塞等待。

### 6.2 Frame 与 Link 的容量约束

- Ethernet 最大帧缓冲由 `ETH_MAX_SIZE` 定义。
- 一个 EtherCAT 帧最多 `15` 个数据报。
- 单个数据报数据最大 `1486` 字节。
- `Link` 最多允许 `255` 个数据报同时在途。
- 帧满时 `Link` 自动发送；`finalizeDatagrams()` 发送最后一帧。

### 6.3 冗余

`Link` 可以同时拥有 nominal 和 redundancy 两个 socket：

- 正常时向两个方向发送。
- 收到的冗余副本由数据报索引合并；已经成功的回调不会被后到的失败副本降级。
- 断链时由 `mergeSplitLRW()` 根据 `LogicalFrameDescription` 和每段 WKC 重建
  `LRW` 的输入数据。
- 邮箱状态位会按位 OR 合并，以便无论从站在断点哪一侧都保留状态。
- `checkRedundancyNeeded()` 通过辅助路径探测是否需要启用冗余。

### 6.4 Socket 后端

| 后端 | 场景 |
|---|---|
| Linux raw socket（AF_PACKET） | 默认真实网卡 |
| Linux AF_XDP | 可选低延迟路径，需要额外依赖和权限 |
| Windows Npcap | 工具/测试，不用于硬实时 |
| `LoopbackSocket` | 主站和软件 ESC 在同一进程 |
| `TapSocket` | 两个进程通过共享内存队列通信 |
| `SocketNull` | 无第二个网口时占位 |

`createSockets()` 根据接口字符串选择后端：

- 普通接口名：平台 raw socket；
- `xdp:<iface>`：启用 AF_XDP 时的 XDP 后端；
- `tap:server` / `tap:client`：共享内存 TAP；
- 空字符串：`SocketNull`。

---

## 7. 从站协议栈

### 7.1 从站组件装配

最小仿真从站由以下对象组成：

```text
EmulatedESC
   ▲             ▲
   │             │
  PDO     mailbox::response::Mailbox
   ▲             ▲
   └── slave::Slave ──► ESM::StateMachine
              ▲
        CoE::Dictionary
```

源码位置：

- `lib/slave/include/kickcat/ESC/EmulatedESC.h`
- `lib/slave/include/kickcat/PDO.h`
- `lib/include/kickcat/Mailbox.h`
- `lib/slave/include/kickcat/slave/Slave.h`
- `lib/slave/include/kickcat/ESM.h`

`slave::Slave` 构造函数只持有 `AbstractESC*` 和 `PDO*`。应用还必须注入：

- 标准邮箱和/或 Bootstrap 邮箱；
- 可选 `CoE::Dictionary`；
- PDO 输入/输出缓冲区。

这些指针都是非拥有关系，相关对象必须活得比 `slave::Slave` 更久。

### 7.2 从站运行循环

`slave::Slave::routine()` 的职责可以压缩为：

1. 如果当前是 BOOT，选择 Bootstrap 邮箱，否则选择标准邮箱。
2. 邮箱 `receive()`：从 ESC SM 读取请求。
3. 邮箱 `process()`：按协议工厂分发并生成应答。
4. 邮箱 `send()`：把应答写回 ESC。
5. ESM `play()`：读取 AL Control、检查看门狗、执行当前状态逻辑、
   更新 AL Status/Status Code。

主站一个周期、从站一个 `routine()`，构成仿真中的基本时间推进。

### 7.3 ESM 状态机

`slave::Slave` 组合了五个状态对象：

- `ESM::Init`
- `ESM::PreOP`
- `ESM::SafeOP`
- `ESM::OP`
- `ESM::Boot`

每个状态根据自己的条件决定：

- 接受还是拒绝目标状态；
- 是否配置/激活邮箱；
- 是否配置 PDO；
- 返回什么 `AL_STATUS_CODE`。

从站应用在 `SAFE_OP` 收到有效输出后，必须调用 `validateOutputData()`；
否则不能进入 OP。

### 7.4 PDO 与对象字典绑定

从站 PDO 的核心不是“另存一份数据”，而是让对象字典条目直接别名到过程缓冲区：

1. `PDO::configure()` 在 ESC 中找到输入/输出 SM。
2. `PDO::configureMapping(dictionary)` 读取 PDO 分配对象
   `0x1C10 + SM index`。
3. 解析 PDO 映射条目中的 index、subindex、bit length。
4. 对每个条目找到 OD 中的真实 `Entry`。
5. 把 `Entry::data` 指向输入/输出过程缓冲区。
6. `updateInput()` 把输入缓冲区写入 ESC；`updateOutput()` 从 ESC 读取输出缓冲区。

因此 PDO 映射正确、OD 存储连续、SM 长度一致，三者缺一不可。

### 7.5 真实 ESC 抽象

`AbstractESC` 提供统一接口：

- 寄存器/内存 `read()`、`write()`；
- `findSm()`、`isSmValid()`、SM 激活；
- 中断/事件、EEPROM 等能力。

实现：

- `Lan9252`：SPI 连接的外部 ESC。
- `XMC4800`：集成 ESC。
- `EmulatedESC`：完整软件模型。

板级 SPI 驱动位于 `lib/slave/driver/`，NuttX 应用位于
`examples/slave/`。

如果需要从主站视角补齐 MCU 内存、SPI/busy、RTOS、并发、看门狗和从站
真机差异，请阅读
[`ethercat-master-embedded-slave-foundations.md`](ethercat-master-embedded-slave-foundations.md)。

### 7.6 软件 ESC 模型

`EmulatedESC` 不是只返回固定响应的 mock，它模拟了：

- 16 个 SyncManager 和 16 个 FMMU；
- 标准寄存器、DL Status、错误计数、告警；
- EEPROM/SII 读取；
- 过程数据 RAM；
- DC 本地时钟、漂移、接收时间、系统时间偏移、SYNC0；
- PDI 和过程数据看门狗；
- 端口回环和 circulating frame 行为。

`EmulatedNetwork` 负责物理拓扑：

- 默认线型 topology；
- 可显式连接分支；
- 按 EtherCAT 端口顺序做帧遍历；
- 运行时断链/恢复；
- 双注入点冗余；
- 根据转发延迟计算 DC 接收时间。

这层模型适合开发协议逻辑，但不能替代真实 PHY、中断、EMC、线缆和 ESC 硅片验证。

---

## 8. 仿真器的两种运行方式

### 8.1 单进程 Loopback

入口：`examples/master/simulated_bus/simulated_bus.cc`

```text
Master Bus ⇄ LoopbackSocket ⇄ EmulatedNetwork ⇄ EmulatedESC + slave::Slave
```

特点：

- 不打开网卡。
- 不需要 TAP、权限或第二个终端。
- 每次主站写帧，仿真网络路由并 tick 从站一次。
- 最适合断点调试和源码学习。

运行：

```bash
./build/examples/master/simulated_bus/simulated_bus \
  -f examples/slave/lan9252/freedom-k64f/nuttx/freedom-k64f.xml \
  -t Board
```

### 8.2 两进程 TAP

```text
Master 进程 ⇄ TapSocket ⇄ shared memory queues ⇄ TapSocket ⇄ network_simulator
                                                         └─ EmulatedNetwork + slaves
```

启动顺序必须是 server 先于 client：

```bash
./build/simulation/network_simulator -i tap:server \
  -s simulation/slave_configs/freedom-k64f.json

./build/examples/master/easycat/easycat_example -i tap:client
```

可在名称后增加后缀并行运行多套总线，例如 `tap:server:benchA`。

### 8.3 ESI 如何变成仿真从站

`network_simulator` 的每个 JSON 配置必须提供 `esi` 或 `eeprom` 之一：

1. 读取 ESI XML 并选中目标设备。
2. 调 `CoE::materializeStorage()` 为 SDO 可访问对象准备存储器。
3. 用 `ESI::buildEepromImage()` 生成 SII/EEPROM 镜像。
4. 加载到 `EmulatedESC`。
5. 从同一 ESI 数据生成 `CoE::Dictionary`。
6. 设置 PDO 输入/输出缓冲区。
7. 可选挂接 DS402 等 `DeviceApp`。
8. 可选启用 FoE 目录存储。

该设计保证仿真中“ESI/EEPROM/OD 不一致”的问题可以在无硬件时提前暴露，但真实
设备的固件 OD 仍可能偏离 ESI，必须上板复核。

---

## 9. 邮箱、CoE 与文件传输

### 9.1 两侧邮箱对象

| 侧 | 类型 | 主要职责 |
|---|---|---|
| 主站 | `mailbox::request::Mailbox` | 创建请求、排队发送、匹配响应、处理超时 |
| 从站 | `mailbox::response::Mailbox` | 接收请求、按协议工厂创建处理器、生成应答 |

两侧共享 `mailbox::Header` 和 CoE/FoE 协议结构。

### 9.2 CoE

核心文件：

- `lib/include/kickcat/CoE/protocol.h`
- `lib/include/kickcat/CoE/OD.h`
- `lib/src/CoE/protocol.cc`
- `lib/src/CoE/OD.cc`
- `lib/src/CoE/mailbox/request.cc`
- `lib/src/CoE/mailbox/response.cc`
- `lib/include/kickcat/CoE/CiA/DS402/`

支持范围包括：

- 快捷、普通、分段 SDO 上传/下载；
- Complete Access 和模拟 Complete Access；
- SDO Information；
- Emergency；
- 对象字典、PDO 映射、PDO 分配。

### 9.3 FoE

FoE 当前为实验性：

- 主站可读写从站文件；
- 从站可由 `FoE::AbstractStorage` 提供文件后端；
- 仿真器可从目录提供存储；
- 支持进入/退出 Bootstrap 状态进行固件传输。

FoE 的 `Busy` 在从站侧不支持；主站超时按“每次交换”计算，不是整个文件传输总时长。

### 9.4 其他协议

- EoE：仅有协议头/规划，尚未形成完整邮箱处理链。
- SoE、AoE、VoE：当前不在路线图上，主要保留了 ESI 解析支持。

---

## 10. 分布式时钟与周期调度

主站 DC 相关入口：

- `Bus::enableDC()`
- `Bus::isDCSynchronized()`
- `Bus::sendDriftCompensation()`
- `Bus::sync(Timer&)`
- `dc.cc`

当前实现思路：

1. 参考时钟通常来自第一个支持 DC 的从站。
2. 通过接收时间测量传播延时，写入各从站传输延时寄存器。
3. 写入系统时间偏移。
4. 周期用 `ARMW/FRMW` 转发参考时钟系统时间并补偿漂移。
5. 配置 SYNC0 周期与启动时刻。
6. 主站用软 PLL 将自己的周期节拍锁相到参考时钟，而不是把主站软件采样时间
   直接写回参考从站。

需要特别注意：真实从站侧 DC 在当前版本中尚未实现；仿真器有 DC 模型，不代表
真实从站应用也具备同步能力。

实时主站通常还需要：

- RT-PREEMPT 内核；
- 实时调度策略；
- 关闭网卡中断合并；
- CPU 隔离和 IRQ 优先级；
- 可选的 AF_XDP 后端。

具体命令见 `KickCAT/docs/PERFORMANCE.md`。Windows 不是硬实时部署目标。

---

## 11. 工具与应用层

### 11.1 C++ 主站示例

| 示例 | 学习价值 |
|---|---|
| `simulated_bus` | 最小全链路，最佳起点 |
| `easycat` | 真实网卡/冗余/周期循环骨架 |
| `freedom-k64f` | 把 PDO 缓冲区映射到 C++ 结构体 |
| `ds402_drive` | 驱动行规与状态机 |
| `load_esi` | ESI 加载与设备选择 |
| `gateway` | ETG.8200 邮箱网关 |
| `wdc_foot` | 从站 CTT 参考应用 |

### 11.2 CLI 与 GUI

- `scan_topology`：拓扑、身份、AL/DL、PDO、错误计数。
- `check_network_stability`：长时间丢包/损坏监测。
- `eeprom`：读取/写入 SII。
- `foe`：文件传输和 Bootstrap 固件更新。
- `od_generator`：从 ESI 生成 `CoE::createOD()`。
- KickUI：拓扑、SDO、PDO、DS402、FoE、事件日志和仿真器启动。
- EEPROM 编辑器：结构化编辑 SII。
- `ethercat_gui`：PySide6 总线监控。

工具不是协议栈的替代品。遇到问题时，先看工具能否给出 WKC、AL Status、
DL Status 和错误计数，再回到对应层。

---

## 12. Python 绑定

顶层 Python 包由 `scikit-build-core + nanobind` 构建。

入口：

- `py_bindings/src/kickcat_py.cc`
- `lib/py_bindings/src/bus_py.cc`
- `lib/py_bindings/src/slave_py.cc`
- `lib/py_bindings/src/mailbox_py.cc`
- `lib/py_bindings/src/lib_py.cc`
- 示例：`py_bindings/examples/`

`PyBus` 额外持有一个 `io_buffer`。原因是 `Bus::createMapping()` 会把 Slave 的
PDO 指针保留到缓冲区内部；Python 侧必须在 `Bus` 生命周期内稳定持有该缓冲区。

Python 解释器访问真实网卡时仍需要 raw socket 权限。仿真 TAP 路径可用于无硬件
实验。

---

## 13. 内存所有权与生命周期

这是读 KickCAT 源码时最容易踩坑的部分。

### 13.1 主站侧

| 对象 | 所有者 | 必须遵守 |
|---|---|---|
| sockets | 调用的 `shared_ptr` / `Link` | `Link` 使用期间保持有效 |
| `Link` | 应用 `shared_ptr` | 比 `Bus` 活得久 |
| `iomap` | 应用 | 比 `Bus` 映射活得久 |
| `Slave.input/output.data` | 指向 `iomap`，非拥有 | 不能单独释放 |
| `Slave.mailbox` | 嵌在 `Slave` 中 | 随 `Bus` 的从站向量一起存在 |
| datagram 回调捕获对象 | 调用者 | 在 `processDatagrams()` 前保持有效 |

### 13.2 从站侧

| 对象 | 所有者 | 必须遵守 |
|---|---|---|
| `EmulatedESC` / 真实 ESC | 应用 | 比 `PDO` 和 `slave::Slave` 活得久 |
| `PDO` | 应用 | 比 `slave::Slave` 活得久 |
| `CoE::Dictionary` | 应用 | 比邮箱和 PDO 映射活得久 |
| `mailbox::response::Mailbox` | 应用 | 比 `slave::Slave` 活得久 |
| PDO 缓冲区 | 应用 | 比 PDO 映射活得久 |
| OD `Entry::data` | 可能由 OD 拥有，也可能别名 PDO 缓冲 | 重新映射时按规则切换 |

`SimulatedSlave` 使用 `unique_ptr` 明确各对象所有权，并用 `std::vector` 作为
过程缓冲，避免聚合对象移动后指针失效。

---

## 14. 测试与质量保障

单元测试是比 README 更精细的行为说明。建议按主题阅读：

| 主题 | 测试 |
|---|---|
| 帧 | `unit/src/frame-t.cc` |
| 协议常量/编解码 | `unit/src/protocol-t.cc` |
| 链路/冗余 | `unit/src/link-t.cc`、`redundancy-t.cc` |
| 主站 | `unit/src/bus-t.cc` |
| ESM | `ESM-t.cc`、`ESMState*-t.cc` |
| 从站 PDO | `unit/src/slave/PDO-t.cc` |
| 从站组合 | `unit/src/slave/slave-t.cc` |
| CoE | `unit/src/CoE/`、`unit/src/mailbox/CoE/` |
| FoE | `unit/src/mailbox/FoE/`、`FoE-sim-t.cc` |
| 软件 ESC | `EmulatedESC-t.cc`、`EmulatedNetwork-t.cc` |
| DC | `unit/src/dc-t.cc` |
| 仿真 | `simulation-t.cc`、`SimulatorControl-t.cc` |
| DS402 | `DS402Drive-t.cc`、`DS402StateMachine-t.cc` |

建议开发流程：

1. 先用测试或最小示例固定当前行为。
2. 改一层，只运行相关测试。
3. 再跑完整 `ctest`。
4. 对跨层行为补集成测试，而不是只补 mock。
5. 涉及时序和硬件的行为，补仿真测试后仍要上板验证。

---

## 15. 已知限制

以下限制直接影响设计，不应等到联调时才发现：

- Little-endian 主机。
- 每个从站只支持一个输入 PDO SM 和一个输出 PDO SM。
- 真实从站侧 DC 未实现；主站 DC 为实验性。
- FoE 主/从两侧均为实验性，从站不支持 Busy。
- EoE 为 Planned；SoE/AoE/VoE 为 Not planned。
- 仿真不模拟中断。
- Windows 不适合硬实时主站。
- SII、ESI、固件 OD 的一致性仍需设备级验证。
- 多厂商 PDO 对齐、INT8 打包、厂商对象差异不能被通用仿真完全覆盖。

---

## 16. 推荐的源码阅读路线

### 16.1 先跑通主站

1. `examples/master/simulated_bus/simulated_bus.cc`
2. `lib/master/src/Bus.cc` 的 `init()`
3. `lib/src/Frame.cc`
4. `lib/master/src/Link.cc`
5. `lib/master/src/Bus.cc` 的映射和周期数据函数
6. `lib/master/src/CoE.cc`
7. `lib/include/kickcat/Mailbox.h`
8. `lib/src/CoE/` 与 `lib/src/ESI/`

### 16.2 再看从站

1. `lib/simulation/src/SimulatedSlave.cc`
2. `lib/slave/include/kickcat/slave/Slave.h`
3. `lib/slave/src/slave/Slave.cc`
4. `lib/slave/src/ESM.cc` 与 `ESMStates.cc`
5. `lib/slave/src/PDO.cc`
6. `lib/src/Mailbox.cc`
7. `lib/slave/src/ESC/EmulatedESC.cc`
8. `lib/slave/src/EmulatedNetwork.cc`

### 16.3 最后看实时与工具

1. `lib/master/src/dc.cc`
2. `lib/src/OS/SoftPll.cc`
3. `lib/src/OS/Linux/Socket.cc`
4. `lib/src/OS/Linux/XdpSocket.cc`
5. `tools/kickui/`
6. `tools/scan_topology.cc`
7. `docs/PERFORMANCE.md`、`docs/HARDWARE.md`

---

## 17. 常见扩展点

| 需求 | 主要改动位置 | 额外工作 |
|---|---|---|
| 新增主站应用 | `examples/master/` | 周期、错误恢复、进程模型、测试 |
| 新增从站设备行为 | `lib/simulation/src/DeviceApp.cc` + 自定义实现 | PDO、OD、ESI/README |
| 新 ESC | 实现 `AbstractESC` 派生类 + SPI/PDI 驱动 | 寄存器差异、EEPROM、看门狗、CTT |
| 新邮箱协议 | `mailbox` request/response + protocol 头 | ESI 声明、超时、分段、错误码 |
| 多 PDO SM | `Bus::detectMapping/buildFrames/configureFMMUs` 和从站 PDO | 映射模型、WKC、帧切分 |
| 掉线自动发现 | `Link`、`Bus`、诊断和状态机 | 拓扑变化、恢复策略、抖动 |
| 更细诊断 | `Diagnostics.cc`、主站 OD/网关 | ETG.1510 兼容性 |
| AF_XDP 生产化 | `OS/Linux/XdpSocket.cc` | 驱动兼容、权限、IRQ、回退 |

扩展时先问：新行为属于协议语义、链路调度、硬件抽象还是应用策略？
层放错，测试和错误处理都会变复杂。

---

## 18. 可验证的最小运行路径

如果只挑一条路径看懂 KickCAT，按以下顺序即可：

1. `simulated_bus` 装配 `EmulatedESC + PDO + slave::Slave + response Mailbox`。
2. `LoopbackSocket` 把主站帧送入 `EmulatedNetwork`。
3. `Bus::init()` 枚举、分配地址、读 SII、配置邮箱，到 PRE_OP。
4. `Bus::createMapping()` 读 PDO 大小、分配逻辑地址、构造帧、写 FMMU。
5. `requestState(SAFE_OP/OPERATIONAL)` 与从站 ESM 交互。
6. `sendLogicalRead/Write/LRW` 在应用 `iomap` 和软件 ESC RAM 之间搬运数据。
7. 邮箱请求经 CoE/FoE 工厂处理，响应回填 `Slave.mailbox`。

沿着这七步读源码，通常比从 OS socket 或硬件 SPI 开始更容易建立整体认识。

---

## 19. 参考资料

- [`../KickCAT/docs/architecture.md`](../KickCAT/docs/architecture.md)
- [`../KickCAT/docs/FEATURES.md`](../KickCAT/docs/FEATURES.md)
- [`../KickCAT/docs/SIMULATION.md`](../KickCAT/docs/SIMULATION.md)
- [`../KickCAT/docs/TOOLS.md`](../KickCAT/docs/TOOLS.md)
- [`../KickCAT/docs/BUILDING.md`](../KickCAT/docs/BUILDING.md)
- [`../KickCAT/docs/HARDWARE.md`](../KickCAT/docs/HARDWARE.md)
- [`../KickCAT/docs/PERFORMANCE.md`](../KickCAT/docs/PERFORMANCE.md)
- [`ethercat-kickcat-learning-plan.md`](ethercat-kickcat-learning-plan.md)
- [`ethercat-master-embedded-slave-foundations.md`](ethercat-master-embedded-slave-foundations.md)
- [`guide.md`](guide.md)

本文是源码导读，不替代 ETG 规范和 CTT 测试。协议字段与行为冲突时，以对应版本的
ETG 规范和一致性测试要求为准。
