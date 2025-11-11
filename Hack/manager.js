/** @param {NS} ns */
import { get_all_servers } from "utility.js"
import { install_hacks } from "utility.js"
export async function main(ns) {
	//Note: Functions mutate variables
	ns.disableLog("getServerMaxRam")
	ns.disableLog("getServerMaxMoney")
	ns.disableLog("getServerMoneyAvailable")

	ns.disableLog("getServerGrowth")
	ns.disableLog("getServerMaxMoney")
	ns.disableLog("getServerMinSecurityLevel")

	ns.disableLog("getServerSecurityLevel")
	ns.disableLog("getHackingLevel")
	ns.disableLog("getServerRequiredHackingLevel")

	ns.disableLog("getServerUsedRam")
	ns.disableLog("scp")
	ns.disableLog("getServerNumPortsRequired")

	ns.disableLog("scan")


	//opens ports gain access and nuke
	install_hacks(ns)

	//target server
	let servers = get_all_servers(ns)

	let avaiable_targets = []
	let highest_quality_server = ""
	let highest_quality_in_server = 0

	for (let server of servers) {
		check_server_quality(server)
	}

	//should have the target
	let longest_time = -1
	let required_hack_threads = 0
	let required_grow_threads = 0
	let required_weaken_threads = 0
	let current_hack_threads = 0
	let current_grow_threads = 0
	let current_weaken_threads = 0
	const target_percentage = 0.1

	//set server to max money and weaken to min_sec
	prep_hack(highest_quality_server)
	ns.print("PrepHacking: " + highest_quality_server)

	for (let target of avaiable_targets) {
		hack(target)
	}

	//wait to finish
	await ns.sleep(longest_time + 10)

	let current_loop = 0

	ns.print("Starting Hack")
	//@ignore-infinite
	while (true) {
		//main loop
		ns.print("Current_loop: " + current_loop)
		calc_threads(highest_quality_server)
		ns.print("Amount of threads: " + (required_hack_threads + required_grow_threads + required_weaken_threads))
		ns.print("Amount of Hack Thread: " + required_hack_threads)
		ns.print("Amount of Grow Thread: " + required_grow_threads)
		ns.print("Amount of Weaken Thread: " + required_weaken_threads)
		for (let target of avaiable_targets) {
			hack(target)
		}
		if ((required_hack_threads + required_grow_threads + required_weaken_threads) == (current_hack_threads + current_grow_threads + current_weaken_threads)){
			ns.tprint("Successful hack")
		}else ns.tprint("Failed hack")

		await ns.sleep(longest_time + 10)
		reset_loop_variables()
		current_loop += 1
	}

	function reset_loop_variables() {
		longest_time = -1
		required_hack_threads = 0
		required_grow_threads = 0
		required_weaken_threads = 0
		current_hack_threads = 0
		current_grow_threads = 0
		current_weaken_threads = 0
	}

	function check_server_quality(passed_target) {
		//make sure its hackable
		if (ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(passed_target)) {
			//add it to the avaiable_targets list
			avaiable_targets.push(passed_target)

			//check if its at least half my level or if its level 0...
			if (ns.getHackingLevel() / 2 >= ns.getServerRequiredHackingLevel(passed_target) || ns.getServerRequiredHackingLevel(passed_target) == 0) {
				//calculate based on how good it gets
				let growth_amount = ns.getServerGrowth(passed_target)
				let max_money = ns.getServerMaxMoney(passed_target)
				let min_security = ns.getServerMinSecurityLevel(passed_target)
				let server_quality = (growth_amount * max_money) / min_security
				//ns.tprint(passed_target + " quality: " + server_quality.toLocaleString("en-US"))

				//doesn't account for equal quality
				if (highest_quality_in_server < server_quality) {
					highest_quality_in_server = server_quality
					highest_quality_server = passed_target
				}
			}
		}
	}

	function prep_hack(passed_target) {
		let grow_time = ns.getGrowTime(passed_target)
		let hack_time = ns.getHackTime(passed_target)
		let weaken_time = ns.getWeakenTime(passed_target)
		let max_time = Math.max(grow_time, hack_time, weaken_time)

		//comes from outside of the function
		longest_time = max_time

		//get amount of threads needed
		let grow_threads = calc_grow_threads(passed_target, target_percentage)
		let weaken_threads = calc_weaken_threads(passed_target)

		//comes from outside of the function
		required_grow_threads = grow_threads
		required_weaken_threads = weaken_threads
	}

	function calc_threads(passed_target) {
		//check for the longest time
		let grow_time = ns.getGrowTime(passed_target)
		let hack_time = ns.getHackTime(passed_target)
		let weaken_time = ns.getWeakenTime(passed_target)
		let max_time = Math.max(grow_time, hack_time, weaken_time)

		//comes from outside of the function
		longest_time = max_time

		//calculate threads needed
		let hack_threads = calc_hack_threads(passed_target, target_percentage)
		let grow_threads = calc_grow_threads(passed_target, target_percentage)
		let weaken_threads = (Math.ceil((hack_threads * ns.hackAnalyzeSecurity(1, passed_target)) + (grow_threads * ns.growthAnalyzeSecurity(1, passed_target, 1)))) / ns.weakenAnalyze(1)

		//comes from outside of the function
		required_hack_threads = hack_threads
		required_grow_threads = grow_threads
		required_weaken_threads = weaken_threads
	}

	function hack(passed_target) {
		const hack_check = (current_hack_threads < required_hack_threads)
		const grow_check = (current_grow_threads < required_grow_threads)
		const weaken_check = (current_weaken_threads < required_weaken_threads)

		const target_ram = ns.getServerMaxRam(passed_target)
		let available_ram = target_ram - ns.getServerUsedRam(passed_target)
		let has_ram = check_ram(target_ram)

		if (hack_check && has_ram) {
			current_hack_threads = check_helper(required_hack_threads, current_hack_threads, "hack.js", longest_time)
		}
		if (grow_check && has_ram) {
			current_grow_threads = check_helper(required_grow_threads, current_grow_threads, "grow.js", longest_time)
		}
		if (weaken_check && has_ram) {
			current_weaken_threads = check_helper(required_weaken_threads, current_weaken_threads, "weaken.js", longest_time)
		}

		//check if you need anymore hacks
		if (hack_check && grow_check && weaken_check)
			return true
		else
			return false

		function check_helper(required, current, script, duration) {
			const script_ram = ns.getScriptRam(script, "home")

			const possible_thread_amount = Math.floor(available_ram / script_ram)
			const needed_threads = required - current

			const threads_to_use = Math.min(possible_thread_amount, needed_threads)
			if (threads_to_use > 0) {
				ns.exec(script, passed_target, threads_to_use, ...[highest_quality_server, longest_time - duration])
				available_ram -= threads_to_use * script_ram
				current += threads_to_use
				has_ram = check_ram(available_ram)
			}

			return current
		}

		function check_ram(passed_ram) {
			const hack_ram = ns.getScriptRam("hack.js", "home")
			const grow_ram = ns.getScriptRam("grow.js", "home")
			const weaken_ram = ns.getScriptRam("weaken.js", "home")

			if (passed_ram > hack_ram || passed_ram > grow_ram || passed_ram > weaken_ram) {
				return true
			} else return false
		}
	}

	function calc_hack_threads(passed_target, passed_pecentage) {
		const money = ns.getServerMoneyAvailable(passed_target)

		// division by zero safety
		if (money <= 0) money = 1

		const hack_threads = Math.ceil(ns.hackAnalyzeThreads(passed_target, money * passed_pecentage))

		return hack_threads
	}

	function calc_grow_threads(passed_target, passed_pecentage = -1) {
		const money = ns.getServerMoneyAvailable(passed_target)
		const max_money = ns.getServerMaxMoney(passed_target)

		// division by zero safety
		if (money <= 0) money = 1

		let grow_threads
		if (passed_pecentage != -1) {
			grow_threads = Math.ceil(ns.growthAnalyze(passed_target, max_money * (1 - passed_pecentage), 1))
		} else {
			grow_threads = Math.ceil(ns.growthAnalyze(passed_target, max_money / money, 1))
		}

		return grow_threads
	}

	function calc_weaken_threads(passed_target) {
		const min_sec = ns.getServerMinSecurityLevel(passed_target)
		const sec = ns.getServerSecurityLevel(passed_target)
		const weaken_threads = Math.ceil((sec - min_sec) / ns.weakenAnalyze(1, 1))

		return weaken_threads
	}
}

